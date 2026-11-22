// Connecting a provider with OAuth (an Organization signs in to Google and allows access), as opposed to pasting a
// key. Three steps:
//   start     a Member with the permission asks to connect; we sign a short-lived `state` naming the Organization,
//             the Member and where to come back to, and send the browser to the provider's consent screen.
//   callback  the provider sends the browser back with a code; we check the state, trade the code for a refresh
//             token, and store it encrypted as the Connection's secret (ADR 0010).
//   calls     invoke() hands the adapter `accessToken()`, which trades the refresh token for an access token and
//             keeps it in memory until a minute before it expires.
// The redirect address is the web app's own origin (`APP_URL/api/v1/oauth/<provider>/callback`), which forwards /api
// to the API, so the provider's console lists one address per environment.
//
// Without the app's OAuth client (no GOOGLE_CLIENT_ID in development), start connects a stub at once: every page
// that needs the Connection works on stub data, as with any stub (ADR 0029).

import { AppError, hmacHex, invalid, safeEqual, type AppContext } from "@app/kernel";
import { providerOf, type ProviderId } from "@app/shared";
import { connect, readSecrets } from "./service";

type OAuthProvider = {
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** The app's OAuth client for this provider, or null when it isn't configured. */
  client: (ctx: AppContext) => { clientId: string; clientSecret: string } | null;
  /** Extra parameters for the consent screen. */
  extra?: Record<string, string>;
};

const google = (scopes: string[]): OAuthProvider => ({
  authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  scopes,
  client: (ctx) => ctx.cfg.google,
  // offline + consent: Google returns a refresh token every time, not only on the first consent.
  extra: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
});

/** Providers connected by OAuth, and how. A new one is an entry here plus its catalog entry with `auth: "oauth"`. */
export const oauthProviders: Partial<Record<ProviderId, OAuthProvider>> = {
  google_business: google(["https://www.googleapis.com/auth/business.manage"]),
};

export const oauthProviderOf = (id: string): OAuthProvider => {
  const p = oauthProviders[id as ProviderId];
  if (!p) throw invalid(`${id} doesn't connect with OAuth.`);
  return p;
};

const redirectUri = (ctx: AppContext, providerId: string) => `${ctx.cfg.appUrl}/api/v1/oauth/${providerId}/callback`;

// ---------- State: signed, short-lived ----------

type State = { o: string; u: string; p: string; r: string; exp: number };
const STATE_TTL_MS = 10 * 60_000;

const b64 = (s: string) => Buffer.from(s).toString("base64url");
export function signState(ctx: AppContext, s: Omit<State, "exp">, now = Date.now()): string {
  const body = b64(JSON.stringify({ ...s, exp: now + STATE_TTL_MS }));
  return `${body}.${hmacHex(ctx.cfg.authSecret, `oauth:${body}`)}`;
}
export function readState(ctx: AppContext, raw: string, now = Date.now()): State {
  const [body, sig] = raw.split(".");
  if (!body || !sig || !safeEqual(sig, hmacHex(ctx.cfg.authSecret, `oauth:${body}`)))
    throw new AppError(400, "bad_request", "The sign-in link isn't valid.");
  const s = JSON.parse(Buffer.from(body, "base64url").toString()) as State;
  if (s.exp < now) throw new AppError(400, "bad_request", "The sign-in took too long. Try connecting again.");
  return s;
}

/** Only paths inside the web app: a state can't be used to send someone elsewhere. */
const safeReturn = (r: string) => (r.startsWith("/") && !r.startsWith("//") ? r : "/");

// ---------- Start and callback ----------

export type StartResult = { url: string };

/**
 * Starts connecting. Returns the provider's consent address; without the app's OAuth client, connects a stub and
 * returns the address to come back to.
 */
export async function startOAuth(
  ctx: AppContext,
  input: { organizationId: string; userId: string; providerId: ProviderId; returnTo: string },
): Promise<StartResult> {
  const p = oauthProviderOf(input.providerId);
  const returnTo = safeReturn(input.returnTo);
  const client = p.client(ctx);
  if (!client) {
    await connect(ctx, {
      organizationId: input.organizationId,
      providerId: input.providerId,
      target: { type: "organization", id: input.organizationId },
      label: providerOf(input.providerId)!.name,
      mode: "stub",
      createdBy: input.userId,
    });
    return { url: withQuery(returnTo, { connected: input.providerId }) };
  }
  const state = signState(ctx, { o: input.organizationId, u: input.userId, p: input.providerId, r: returnTo });
  const url = new URL(p.authorizeUrl);
  url.search = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: redirectUri(ctx, input.providerId),
    response_type: "code",
    scope: p.scopes.join(" "),
    state,
    ...p.extra,
  }).toString();
  return { url: url.toString() };
}

/** The provider sent the browser back. Stores the Connection and returns where in the web app to go. */
export async function finishOAuth(
  ctx: AppContext,
  providerId: string,
  q: { code?: string; state?: string; error?: string },
): Promise<string> {
  if (!q.state) throw new AppError(400, "bad_request", "The sign-in link isn't valid.");
  const s = readState(ctx, q.state);
  if (s.p !== providerId) throw new AppError(400, "bad_request", "The sign-in link isn't valid.");
  if (q.error || !q.code) return withQuery(s.r, { oauth_error: q.error ?? "cancelled" });
  const p = oauthProviderOf(providerId);
  const client = p.client(ctx);
  if (!client) throw new AppError(409, "needs_connection", "The app has no OAuth client for this provider.");
  const res = await fetch(p.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: q.code,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uri: redirectUri(ctx, providerId),
      grant_type: "authorization_code",
    }),
  });
  const token = (await res.json().catch(() => ({}))) as { refresh_token?: string; error_description?: string };
  if (!res.ok || !token.refresh_token) return withQuery(s.r, { oauth_error: token.error_description ?? "no_refresh_token" });
  await connect(ctx, {
    organizationId: s.o,
    providerId: providerId as ProviderId,
    target: { type: "organization", id: s.o },
    label: providerOf(providerId as ProviderId)!.name,
    secrets: { refreshToken: token.refresh_token },
    mode: "live",
    createdBy: s.u,
  });
  return withQuery(s.r, { connected: providerId });
}

function withQuery(path: string, q: Record<string, string>): string {
  const [base, query] = path.split("?");
  const params = new URLSearchParams(query);
  for (const [k, v] of Object.entries(q)) params.set(k, v);
  return `${base}?${params}`;
}

// ---------- Access tokens ----------

const tokens = new Map<string, { token: string; expiresAt: number }>();

/** A current access token for an OAuth Connection, refreshed when it's within a minute of expiring. */
export async function accessTokenFor(ctx: AppContext, connectionId: string, providerId: ProviderId): Promise<string> {
  const held = tokens.get(connectionId);
  if (held && held.expiresAt - 60_000 > Date.now()) return held.token;
  const p = oauthProviderOf(providerId);
  const client = p.client(ctx);
  const { refreshToken } = await readSecrets(ctx, connectionId);
  if (!client || !refreshToken) throw new AppError(409, "needs_connection", "Connect the account again: its sign-in is missing.");
  const res = await fetch(p.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!res.ok || !json.access_token) throw new AppError(409, "needs_connection", "The account's sign-in has expired. Connect it again.");
  tokens.set(connectionId, { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 });
  return json.access_token;
}

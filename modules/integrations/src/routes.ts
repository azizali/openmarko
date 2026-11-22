import { Elysia, t } from "elysia";
import { ids, invalid, logActivity, type AppContext } from "@app/kernel";
import { permissionsFor, providerOf, providers, requireAllowed, type ProviderId, type Resource } from "@app/shared";
import { connect, disconnect, disconnectAppConnection, listAppConnections, listConnections, setAppConnectionMode } from "./service";
import { receiveWebhook, WEBHOOK_SECRET_FIELD } from "./webhooks";
import { splitFieldValues } from "./fields";
import { finishOAuth, oauthProviderOf, startOAuth } from "./oauth";

const connectBody = t.Object({
  providerId: t.String({ minLength: 1 }),
  label: t.String({ minLength: 1, maxLength: 120 }),
  externalId: t.Optional(t.String()),
  // The provider's fields: secret ones are encrypted, the rest become settings (splitFieldValues).
  values: t.Optional(t.Record(t.String(), t.String())),
});

const modeBody = t.Union([t.Literal("live"), t.Literal("stub")]);

function knownProvider(id: string) {
  const p = providerOf(id as ProviderId);
  if (!p) throw invalid(`Unknown provider "${id}".`);
  return p;
}

/**
 * The catalog as the web app renders it: each provider with its fields, for the connect forms. An Organization sees
 * what it may connect itself (not the app-only accounts); the app sees what it connects with a key (not OAuth).
 */
const catalog = (forApp = false) =>
  providers
    .filter((p) => (forApp ? p.auth !== "oauth" : p.attach !== "app"))
    .map((p) => ({
      id: p.id,
      name: p.name,
      vendor: p.vendor ?? null,
      mark: p.mark,
      color: p.color,
      category: p.category,
      blurb: p.blurb,
      auth: p.auth,
      capabilities: p.capabilities,
      fields: [...(p.fields ?? []), ...(forApp ? [WEBHOOK_SECRET_FIELD] : [])],
    }));

/**
 * Settings → Integrations: list, connect and disconnect. Connecting a provider needs every permission its
 * capabilities ask for (ADR 0002).
 */
export function integrationRoutes(ctx: AppContext) {
  const orgRoutes = new Elysia({ name: "integrations.connections" }).group("/api/v1/organizations/:orgId/connections", (g) =>
    g
      .use(ctx.orgGuard!)
      .get("/providers", () => catalog(), {
        detail: { summary: "What an organization can connect, with each provider's fields" },
        params: ids(),
      })
      .get(
        "/",
        ({ caller }) => {
          requireAllowed(caller, "setup", "view");
          return listConnections(ctx, caller.orgId);
        },
        { detail: { summary: "List this organization's connections (no secrets)" }, params: ids() },
      )
      .post(
        "/",
        async ({ caller, body }) => {
          const provider = knownProvider(body.providerId);
          for (const [resource, action] of permissionsFor(provider)) requireAllowed(caller, resource as Resource, action);
          const id = await connect(ctx, {
            organizationId: caller.orgId,
            providerId: provider.id,
            target: { type: "organization", id: caller.orgId },
            externalId: body.externalId ?? null,
            label: body.label,
            ...splitFieldValues(provider, body.values ?? {}),
            // An Organization's own account is real: stub or live is the app admin's choice, for the app's accounts.
            mode: "live",
            createdBy: caller.userId,
          });
          return { id };
        },
        { detail: { summary: "Connect a provider" }, params: ids(), body: connectBody },
      )
      .post(
        "/oauth/:providerId",
        async ({ caller, params, body }) => {
          const provider = knownProvider(params.providerId);
          oauthProviderOf(provider.id);
          for (const [resource, action] of permissionsFor(provider)) requireAllowed(caller, resource as Resource, action);
          return startOAuth(ctx, { organizationId: caller.orgId, userId: caller.userId, providerId: provider.id, returnTo: body.returnTo });
        },
        {
          detail: { summary: "Start connecting a provider by signing in to it (OAuth): returns the address to send the browser to" },
          params: t.Object({ orgId: t.String({ format: "uuid" }), providerId: t.String() }),
          body: t.Object({ returnTo: t.String({ maxLength: 500 }) }),
        },
      )
      .delete(
        "/:connectionId",
        async ({ caller, params }) => {
          requireAllowed(caller, "setup", "connect");
          await disconnect(ctx, caller.orgId, params.connectionId, caller.userId);
          return { ok: true };
        },
        { detail: { summary: "Disconnect a provider" }, params: ids("connectionId") },
      ),
  );

  // The platform admin area: the app's own accounts (its default model key, its email provider), used by every Organization
  // without its own. Each may also hold the secret that signs the provider's webhooks to this app.
  const adminRoutes = new Elysia({ name: "integrations.admin" }).group("/api/v1/admin/connections", (g) =>
    g
      .use(ctx.adminGuard!)
      .get("/providers", () => catalog(true), {
        detail: { summary: "What the app can connect as its own account, with each one's fields" },
      })
      .get("/", () => listAppConnections(ctx), { detail: { summary: "The app's own Connections (no secrets)" } })
      .post(
        "/",
        async ({ admin, body }) => {
          const provider = knownProvider(body.providerId);
          const id = await connect(ctx, {
            organizationId: null,
            providerId: provider.id,
            target: { type: "app", id: null },
            label: body.label ?? provider.name,
            ...splitFieldValues({ name: provider.name, fields: [...(provider.fields ?? []), WEBHOOK_SECRET_FIELD] }, body.values),
            mode: body.mode,
            createdBy: admin.userId,
          });
          return { id };
        },
        {
          body: t.Object({
            providerId: t.String({ minLength: 1 }),
            label: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
            values: t.Record(t.String(), t.String()),
            mode: t.Optional(modeBody),
          }),
          detail: { summary: "Connect the app's own account with a provider (replaces its earlier one for that provider)" },
        },
      )
      .patch(
        "/:connectionId",
        async ({ admin, params, body }) => {
          await setAppConnectionMode(ctx, params.connectionId, body.mode, admin.userId);
          return { ok: true };
        },
        {
          body: t.Object({ mode: modeBody }),
          detail: { summary: "Switch one of the app's own accounts between live and stub" },
          params: t.Object({ connectionId: t.String({ format: "uuid" }) }),
        },
      )
      .delete(
        "/:connectionId",
        async ({ admin, params }) => {
          await disconnectAppConnection(ctx, params.connectionId, admin.userId);
          await ctx.db.transaction((tx) =>
            logActivity(tx, {
              actorType: "admin",
              actorId: admin.userId,
              action: "setup.connect",
              resourceType: "connection",
              resourceId: params.connectionId,
              summary: "Disconnected one of the app's accounts",
            }),
          );
          return { ok: true };
        },
        {
          detail: { summary: "Disconnect one of the app's own accounts" },
          params: t.Object({ connectionId: t.String({ format: "uuid" }) }),
        },
      ),
  );

  // Provider webhooks: authenticated by signature, not by a session.
  const webhooks = new Elysia({ name: "integrations.webhooks" }).post(
    "/api/v1/webhooks/:provider",
    async ({ params, request }) => receiveWebhook(ctx, params.provider, await request.text(), request.headers.get("x-webhook-signature")),
    { detail: { summary: "Receive a signed provider webhook" } },
  );

  // Where a provider sends the browser back after signing in. The signed state names the Organization and the Member.
  const oauthCallback = new Elysia({ name: "integrations.oauth" }).get(
    "/api/v1/oauth/:providerId/callback",
    async ({ params, query, redirect }) => {
      const back = await finishOAuth(ctx, params.providerId, query);
      return redirect(`${ctx.cfg.appUrl}${back}`, 302);
    },
    {
      detail: { summary: "The provider's sign-in comes back here (OAuth callback)" },
      query: t.Object({ code: t.Optional(t.String()), state: t.Optional(t.String()), error: t.Optional(t.String()) }),
    },
  );

  return new Elysia({ name: "integrations.all" }).use(orgRoutes).use(adminRoutes).use(webhooks).use(oauthCallback);
}

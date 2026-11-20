// The chat widget: a website adds one script, and its visitors chat with one of an Organization's assistants,
// anonymously. The public internet reaches this, so every call checks, in order:
//   - an assistant with its widget on, and a browser origin it allows;
//   - a visitor token the app signed for this assistant and this conversation (24 hours);
//   - Cloudflare Turnstile before a visitor gets a token, when TURNSTILE_* are set;
//   - turns per visitor, chat streams per process, and the Organization's Plan, as for members.
import { createHmac, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import { Elysia, t } from "elysia";
import { and, asc, eq } from "drizzle-orm";
import { AppError, forbidden, newId, notFound, unauthorized, type AppContext } from "@app/kernel";
import { assistants, conversations, messages } from "./schema";
import { runTurn } from "./chat";

const TOKEN_HOURS = 24;
const VISITOR_TURNS = 30;
const VISITOR_WINDOW_MS = 10 * 60_000;

type VisitorToken = { a: string; c: string; v: string; exp: number };

const key = (ctx: AppContext) => createHmac("sha256", ctx.cfg.authSecret).update("widget-visitor-v1").digest();
const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function signVisitor(ctx: AppContext, p: Omit<VisitorToken, "exp">): string {
  const body = b64(JSON.stringify({ ...p, exp: Math.floor(Date.now() / 1000) + TOKEN_HOURS * 3600 }));
  return `${body}.${b64(createHmac("sha256", key(ctx)).update(body).digest())}`;
}

export function readVisitor(ctx: AppContext, token: string | null): VisitorToken | null {
  const [body, sig] = (token ?? "").split(".");
  if (!body || !sig) return null;
  const want = createHmac("sha256", key(ctx)).update(body).digest();
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  const p = JSON.parse(Buffer.from(body, "base64url").toString()) as VisitorToken;
  return p.exp > Date.now() / 1000 ? p : null;
}

/** The assistant a widget call is for, if its widget is on and this origin may use it. */
async function widgetAssistant(ctx: AppContext, headers: Headers, assistantId: string) {
  const [a] = await ctx.db.select().from(assistants).where(eq(assistants.id, assistantId));
  if (!a || !a.widget.enabled) throw notFound("Assistant");
  const origin = headers.get("origin");
  if (!origin || !a.widget.allowedOrigins.includes(origin)) throw forbidden("This assistant doesn't answer on this website.");
  return a;
}

/** Cloudflare's answer on a Turnstile token. */
async function turnstilePasses(secret: string, token: string, ip: string | null): Promise<boolean> {
  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  if (ip) form.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    return ((await res.json()) as { success?: boolean }).success === true;
  } catch {
    return false;
  }
}

/** Builds the widget script from packages/chat-widget (no dependencies). */
const buildWidget = () =>
  Bun.build({
    entrypoints: [join(import.meta.dir, "../../../packages/chat-widget/src/widget.ts")],
    minify: true,
    target: "browser",
  }).then(async (r) => {
    if (!r.success) throw new Error(`The widget didn't build: ${r.logs.join("\n")}`);
    return r.outputs[0]!.text();
  });
let built: Promise<string> | null = null;
/** Built once per process in production; on every request otherwise, since the API doesn't watch the widget's files. */
const widgetScript = (ctx: AppContext) => (ctx.cfg.nodeEnv === "production" ? (built ??= buildWidget()) : buildWidget());

/** The line a website pastes. It loads from the API itself: visitors have no cookie that needs the app's origin (ADR 0028). */
export const embedCode = (ctx: AppContext, assistantId: string) =>
  `<script src="${ctx.cfg.authUrl}/widget/v1.js" data-assistant="${assistantId}" async></script>`;

export function widgetRoutes(ctx: AppContext) {
  const turns = new Map<string, { start: number; count: number }>();
  const visitorTurn = (visitor: string) => {
    const now = Date.now();
    const w = turns.get(visitor);
    if (!w || now - w.start > VISITOR_WINDOW_MS) return void turns.set(visitor, { start: now, count: 1 });
    if (++w.count > VISITOR_TURNS) throw new AppError(429, "rate_limited", "That's a lot of messages. Try again in a few minutes.");
  };
  const visitorFrom = async (headers: Headers, conversationId: string) => {
    const token = readVisitor(ctx, headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null);
    if (!token || token.c !== conversationId) throw unauthorized();
    const assistant = await widgetAssistant(ctx, headers, token.a);
    const [conv] = await ctx.db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.assistantId, token.a)));
    if (!conv) throw notFound("Conversation");
    return { assistant, token, conv };
  };

  return new Elysia({ name: "ai.widget" })
    .get(
      "/widget/v1.js",
      async ({ set }) => {
        set.headers["content-type"] = "application/javascript; charset=utf-8";
        set.headers["cache-control"] = ctx.cfg.nodeEnv === "production" ? "public, max-age=3600" : "no-store";
        return widgetScript(ctx);
      },
      { detail: { summary: "The chat widget's script: add it to a page with data-assistant" } },
    )
    .group("/api/v1/widget", (g) =>
      g
        .get(
          "/assistants/:assistantId",
          async ({ request, params }) => {
            const assistant = await widgetAssistant(ctx, request.headers, params.assistantId);
            return {
              name: assistant.name,
              greeting: assistant.widget.greeting,
              accent: assistant.widget.accent,
              turnstileSiteKey: ctx.cfg.turnstile?.siteKey ?? null,
            };
          },
          { detail: { summary: "What the widget shows for an assistant (from an allowed origin)" } },
        )
        .post(
          "/assistants/:assistantId/sessions",
          async ({ request, params, body, server }) => {
            const assistant = await widgetAssistant(ctx, request.headers, params.assistantId);
            if (ctx.cfg.turnstile) {
              const ip = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? server?.requestIP(request)?.address ?? null;
              if (!body.turnstileToken || !(await turnstilePasses(ctx.cfg.turnstile.secretKey, body.turnstileToken, ip))) {
                throw forbidden("The visitor check didn't pass. Reload the page and try again.");
              }
            }
            const visitorId = newId();
            const conversationId = newId();
            await ctx.db.insert(conversations).values({
              id: conversationId,
              organizationId: assistant.organizationId,
              userId: `visitor:${visitorId}`,
              assistantId: assistant.id,
              title: "Website chat",
            });
            return {
              conversationId,
              token: signVisitor(ctx, { a: assistant.id, c: conversationId, v: visitorId }),
              expiresAt: Date.now() + TOKEN_HOURS * 3600_000,
            };
          },
          {
            body: t.Object({ turnstileToken: t.Optional(t.String({ maxLength: 4096 })) }),
            detail: {
              summary: "Start a visitor's conversation; returns the token the widget sends with each message, and when it expires",
            },
          },
        )
        .get(
          "/conversations/:conversationId/messages",
          async ({ request, params }) => {
            const { conv } = await visitorFrom(request.headers, params.conversationId);
            const rows = await ctx.db
              .select({ role: messages.role, parts: messages.parts, sources: messages.sources })
              .from(messages)
              .where(eq(messages.conversationId, conv.id))
              .orderBy(asc(messages.createdAt), asc(messages.id));
            return rows.map((m) => ({
              role: m.role,
              parts: m.parts,
              sources: (m.sources ?? []).map((s) => ({ documentTitle: s.documentTitle })),
            }));
          },
          { detail: { summary: "A visitor's conversation so far (their token)" } },
        )
        .post(
          "/conversations/:conversationId/chat",
          async ({ request, params, body }) => {
            const { conv, assistant, token } = await visitorFrom(request.headers, params.conversationId);
            visitorTurn(token.v);
            return runTurn(ctx, { orgId: assistant.organizationId, conv, text: body.text, signal: request.signal });
          },
          {
            body: t.Object({ text: t.String({ minLength: 1, maxLength: 2000 }) }),
            detail: { summary: "A visitor's message; the answer streams back (AI SDK UI message stream)" },
          },
        ),
    );
}

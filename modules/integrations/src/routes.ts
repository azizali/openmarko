import { Elysia, t } from "elysia";
import { and, eq } from "drizzle-orm";
import { AppError, ids, safeEqual, invalid, notFound, type AppContext } from "@openmarko/kernel";
import { locations, websites } from "@openmarko/organizations/schema";
import { permissionsFor, providerOf, requireAllowed, type ProviderId, type Resource } from "@openmarko/shared";
import { connect, disconnect, listConnections } from "./service";
import { receiveWebhook } from "./webhooks";
import { splitFieldValues } from "./fields";

const targetTypes = t.Union([t.Literal("organization"), t.Literal("location"), t.Literal("website")]);
const connectBody = t.Object({
  providerId: t.String({ minLength: 1 }),
  target: t.Object({ type: targetTypes, id: t.String({ format: "uuid" }) }),
  externalId: t.Optional(t.String()),
  label: t.String({ minLength: 1, maxLength: 120 }),
  // The provider's fields: secret ones are encrypted, the rest become settings (splitFieldValues).
  values: t.Optional(t.Record(t.String(), t.String())),
});

function knownProvider(id: string) {
  const p = providerOf(id as ProviderId);
  if (!p) throw invalid(`Unknown provider "${id}".`);
  if (id === "platform_llm") throw invalid("The platform default is set by the platform admin, not an organization.");
  return p;
}

/** A connection may only point at this Organization, or at one of its own Locations or Websites. */
async function assertOwnTarget(ctx: AppContext, orgId: string, target: { type: string; id: string }) {
  const table = target.type === "location" ? locations : target.type === "website" ? websites : null;
  if (!table) {
    if (target.id !== orgId) throw invalid("An organization connection must target this organization.");
    return;
  }
  const [row] = await ctx.db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, target.id), eq(table.organizationId, orgId)));
  if (!row) throw notFound(target.type === "location" ? "Location" : "Website");
}

/**
 * Settings → Integrations: list, connect and disconnect. Connecting a provider needs every permission its
 * capabilities ask for (ADR 0002), so a Social media manager can connect Instagram but not Twilio.
 */
export function integrationRoutes(ctx: AppContext) {
  const orgRoutes = new Elysia({ name: "integrations.connections" }).group("/api/v1/organizations/:orgId/connections", (g) =>
    g
      .use(ctx.orgGuard!)
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
          await assertOwnTarget(ctx, caller.orgId, body.target);
          const id = await connect(ctx, {
            organizationId: caller.orgId,
            providerId: provider.id,
            target: body.target,
            externalId: body.externalId ?? null,
            label: body.label,
            ...splitFieldValues(provider, body.values ?? {}),
            createdBy: caller.userId,
          });
          return { id };
        },
        { detail: { summary: "Connect a provider" }, params: ids(), body: connectBody },
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

  // Platform admin: the default model connection every Organization without its own key uses (ADR 0014).
  const adminRoutes = new Elysia({ name: "integrations.admin" }).post(
    "/api/v1/admin/connections/platform-llm",
    async ({ headers, body }) => {
      if (!safeEqual(headers["x-admin-token"] ?? null, ctx.cfg.platformAdminToken))
        throw new AppError(401, "unauthorized", "Platform admin token required.");
      const id = await connect(ctx, {
        organizationId: null,
        providerId: "platform_llm",
        target: { type: "platform", id: null },
        label: body.label,
        secrets: { apiKey: body.apiKey, vendor: body.vendor, ...(body.model ? { model: body.model } : {}) },
      });
      return { id };
    },
    {
      detail: { summary: "Set the platform's default model connection (platform admin)" },
      body: t.Object({
        label: t.String({ minLength: 1 }),
        vendor: t.Union([t.Literal("anthropic"), t.Literal("openai")]),
        apiKey: t.String({ minLength: 8 }),
        model: t.Optional(t.String()),
      }),
    },
  );

  // Provider webhooks: authenticated by signature, not by a session.
  const webhooks = new Elysia({ name: "integrations.webhooks" }).post(
    "/api/v1/webhooks/:provider",
    async ({ params, request }) => {
      return receiveWebhook(ctx, params.provider, await request.text(), request.headers.get("x-openmarko-signature"));
    },
    { detail: { summary: "Receive a signed provider webhook" } },
  );

  return orgRoutes.use(adminRoutes).use(webhooks);
}

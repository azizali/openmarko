import { Elysia, t } from "elysia";
import { AppError, defineModule, parseJsonObject, safeEqual, type AppContext } from "@openmarko/kernel";
import { requireAllowed } from "@openmarko/shared";
import { entitlementsFor, planIdFor } from "./entitlements";
import { applyStripeSubscription, assignPlanManually, setOverride, startStripeCheckout, upsertPlan } from "./service";
import { stripeClient, verifyStripeSignature } from "./providers";

/** Platform admin routes are closed unless PLATFORM_ADMIN_TOKEN is set (ADR 0012: Plans are the owner's). */
function requireAdmin(ctx: AppContext, header: string | null) {
  if (!safeEqual(header, ctx.cfg.platformAdminToken)) {
    throw new AppError(401, "unauthorized", "Platform admin token required.");
  }
}

export const billingModule = defineModule({
  id: "billing",
  setup: (ctx) => ({ routes: billingRoutes(ctx) }),
});

/** The routes this module adds. Built from the context; used by setup at runtime and by the typed API shape. */
export function billingRoutes(ctx: AppContext) {
  const planBody = t.Object({
    id: t.String({ minLength: 1 }),
    name: t.String({ minLength: 1 }),
    sort: t.Optional(t.Number()),
    entitlements: t.Record(t.String(), t.Union([t.Number(), t.Null()])),
    meters: t.Optional(
      t.Array(
        t.Object({
          meter: t.String(),
          included: t.Union([t.Number(), t.Null()]),
          overage: t.Union([t.Literal("block"), t.Literal("charge"), t.Literal("byok_only")]),
          unitPriceMicros: t.Optional(t.Union([t.Number(), t.Null()])),
        }),
      ),
    ),
    prices: t.Optional(
      t.Array(
        t.Object({
          interval: t.Union([t.Literal("month"), t.Literal("year")]),
          amountCents: t.Number(),
          currency: t.Optional(t.String()),
          providerPriceId: t.Optional(t.Union([t.String(), t.Null()])),
        }),
      ),
    ),
  });

  const routes = new Elysia({ name: "billing" })
    // Organization-scoped: what the Organization is on.
    .group("/api/v1/organizations/:orgId", (g) =>
      g
        .use(ctx.orgGuard!)
        .get(
          "/billing",
          async ({ caller }) => {
            requireAllowed(caller, "billing", "view");
            const planId = await planIdFor(ctx, caller.orgId);
            const ent = await entitlementsFor(ctx, caller.orgId);
            return { planId, entitlements: Object.fromEntries(ent) };
          },
          { detail: { summary: "Get this organization's plan and entitlements" } },
        )
        // Owner only (billing.update is owner-only). The subscription starts incomplete until Stripe confirms it.
        .post(
          "/billing/checkout",
          async ({ caller, body }) => {
            requireAllowed(caller, "billing", "update");
            const key = ctx.cfg.stripe.secretKey;
            if (!key) throw new AppError(503, "not_configured", "STRIPE_SECRET_KEY is not set.");
            return startStripeCheckout(ctx, stripeClient(key), { orgId: caller.orgId, planId: body.planId, email: body.email });
          },
          {
            detail: { summary: "Start a Stripe subscription for this organization (owner only)" },
            body: t.Object({ planId: t.String(), email: t.String({ format: "email" }) }),
          },
        ),
    )
    // Provider webhooks: authenticated by signature, not by a session.
    .post(
      "/api/v1/webhooks/stripe",
      async ({ request, headers }) => {
        const raw = await request.text();
        const secret = ctx.cfg.stripe.webhookSecret;
        if (!secret) throw new AppError(503, "not_configured", "STRIPE_WEBHOOK_SECRET is not set.");
        verifyStripeSignature(raw, headers["stripe-signature"] ?? null, secret);
        const event = parseJsonObject(raw) as { type: string; data: { object: any } };
        if (event.type.startsWith("customer.subscription.")) {
          const planId = event.data.object.metadata?.planId as string | undefined;
          await applyStripeSubscription(ctx, event.data.object, planId);
        }
        return { received: true };
      },
      { detail: { summary: "Receive a Stripe webhook" } },
    )
    // Platform admin: Plans, and assigning them with no payment.
    .group("/api/v1/admin", (g) =>
      g
        .post(
          "/plans",
          async ({ body, headers }) => {
            requireAdmin(ctx, headers["x-admin-token"] ?? null);
            await upsertPlan(ctx, body as any);
            return { ok: true };
          },
          { detail: { summary: "Create or replace a plan (platform admin)" }, body: planBody },
        )
        .post(
          "/organizations/:orgId/plan",
          async ({ params, body, headers }) => {
            requireAdmin(ctx, headers["x-admin-token"] ?? null);
            const id = await assignPlanManually(ctx, params.orgId, body.planId, null);
            return { subscriptionId: id };
          },
          { detail: { summary: "Assign a plan with no payment (platform admin)" }, body: t.Object({ planId: t.String() }) },
        )
        .post(
          "/organizations/:orgId/overrides",
          async ({ params, body, headers }) => {
            requireAdmin(ctx, headers["x-admin-token"] ?? null);
            await setOverride(ctx, params.orgId, body.key, body.value, body.reason, {
              expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
            });
            return { ok: true };
          },
          {
            detail: { summary: "Set an entitlement override (platform admin)" },
            body: t.Object({
              key: t.String(),
              value: t.Union([t.Number(), t.Null()]),
              reason: t.String({ minLength: 1 }),
              expiresAt: t.Optional(t.Union([t.String(), t.Null()])),
            }),
          },
        ),
    );
  return routes;
}

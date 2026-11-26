import { Elysia, t } from "elysia";
import { AppError, logActivity, parseJsonObject, type AppContext } from "@app/kernel";
import { requireAllowed } from "@app/shared";
import { entitlementsFor, planIdFor } from "./entitlements";
import {
  applyStripeSubscription,
  assignPlanManually,
  listPlans,
  publicPlans,
  setOverride,
  startStripeCheckout,
  upsertPlan,
  type PlanInput,
} from "./service";
import { stripeClient, verifyStripeSignature } from "./providers";

/** Postgres sums come back as strings; the platform admin area wants numbers (ids stay strings). */
const numbers = (r: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(r).map(([k, v]) => [k, typeof v === "string" && /^\d+$/.test(v) && k !== "organizationId" ? Number(v) : v]),
  );

/** The routes this module adds. Built from the context; used by setup at runtime and by the typed API shape. */
export function billingRoutes(ctx: AppContext) {
  const planBody = t.Object({
    id: t.String({ minLength: 1 }),
    name: t.String({ minLength: 1 }),
    description: t.Optional(t.String({ maxLength: 300 })),
    sort: t.Optional(t.Number()),
    active: t.Optional(t.Boolean()),
    default: t.Optional(t.Boolean()),
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

  const orgRoutes = new Elysia({ name: "billing.org" }).group("/api/v1/organizations/:orgId/billing", (g) =>
    g
      .use(ctx.orgGuard!)
      .get(
        "/",
        async ({ caller }) => {
          requireAllowed(caller, "billing", "view");
          const planId = await planIdFor(ctx, caller.orgId);
          const ent = await entitlementsFor(ctx, caller.orgId);
          return { planId, entitlements: Object.fromEntries(ent), plans: await publicPlans(ctx), stripe: ctx.cfg.stripe !== null };
        },
        { detail: { summary: "This organization's plan and entitlements, and the Plans it could move to" } },
      )
      // Owner only (billing.update is owner-only). The subscription starts incomplete until Stripe confirms it.
      .post(
        "/checkout",
        async ({ caller, body }) => {
          requireAllowed(caller, "billing", "update");
          if (!ctx.cfg.stripe) throw new AppError(503, "not_configured", "Stripe isn't configured (STRIPE_SECRET_KEY).");
          return startStripeCheckout(ctx, stripeClient(ctx.cfg.stripe.secretKey), {
            orgId: caller.orgId,
            planId: body.planId,
            email: body.email,
          });
        },
        {
          detail: { summary: "Start a Stripe subscription for this organization (owner only)" },
          body: t.Object({ planId: t.String(), email: t.String({ format: "email" }) }),
        },
      ),
  );

  // Provider webhooks: authenticated by signature, not by a session.
  const webhooks = new Elysia({ name: "billing.webhooks" }).post(
    "/api/v1/webhooks/stripe",
    async ({ request, headers }) => {
      const raw = await request.text();
      const secret = ctx.cfg.stripe?.webhookSecret;
      if (!secret) throw new AppError(503, "not_configured", "Stripe webhooks aren't configured (STRIPE_WEBHOOK_SECRET).");
      verifyStripeSignature(raw, headers["stripe-signature"] ?? null, secret);
      const event = parseJsonObject(raw) as { type: string; data: { object: any } };
      if (event.type.startsWith("customer.subscription.")) {
        const planId = event.data.object.metadata?.planId as string | undefined;
        await applyStripeSubscription(ctx, event.data.object, planId);
      }
      return { received: true };
    },
    { detail: { summary: "Receive a Stripe webhook" } },
  );

  // The platform admin area: Plans, what Organizations used, assigning Plans with no payment, and overrides.
  const admin = new Elysia({ name: "billing.admin" }).group("/api/v1/admin", (g) =>
    g
      .use(ctx.adminGuard!)
      .get("/plans", () => listPlans(ctx), {
        detail: { summary: "Every Plan: what it grants and meters, and how many Organizations are on it" },
      })
      .put(
        "/plans",
        async ({ admin, body }) => {
          await upsertPlan(ctx, body as PlanInput);
          await ctx.db.transaction((tx) =>
            logActivity(tx, {
              actorType: "admin",
              actorId: admin.userId,
              action: "plans.save",
              resourceType: "plan",
              resourceId: body.id,
              summary: `Saved the ${body.name} Plan`,
            }),
          );
          return { ok: true };
        },
        { body: planBody, detail: { summary: "Create or replace a Plan" } },
      )
      .get(
        "/usage",
        async ({ query }) => {
          const days = Math.min(90, Math.max(1, Number(query.days ?? 30)));
          const since = `now() - interval '${days} days'`;
          const [byMeter, byDay, byOrg] = await Promise.all([
            ctx.pool.query(
              `select meter, sum(quantity)::bigint as quantity, sum(cost_micros)::bigint as "costMicros", count(*)::int as events from billing.usage_events where occurred_at > ${since} group by meter order by meter`,
            ),
            ctx.pool.query(
              `select date_trunc('day', occurred_at)::date as day, meter, sum(quantity)::bigint as quantity, sum(cost_micros)::bigint as "costMicros" from billing.usage_events where occurred_at > ${since} group by 1, 2 order by 1`,
            ),
            ctx.pool.query(
              `select u.organization_id as "organizationId", o.name, sum(u.cost_micros)::bigint as "costMicros", sum(u.quantity)::bigint as quantity from billing.usage_events u join auth.organization o on o.id = u.organization_id where u.occurred_at > ${since} group by 1, 2 order by 3 desc limit 10`,
            ),
          ]);
          return {
            days,
            byMeter: byMeter.rows.map(numbers),
            byDay: byDay.rows.map(numbers),
            topOrganizations: byOrg.rows.map(numbers),
          } as {
            days: number;
            byMeter: { meter: string; quantity: number; costMicros: number; events: number }[];
            byDay: { day: string; meter: string; quantity: number; costMicros: number }[];
            topOrganizations: { organizationId: string; name: string; costMicros: number; quantity: number }[];
          };
        },
        {
          query: t.Object({ days: t.Optional(t.String()) }),
          detail: { summary: "What Organizations used: by meter, by day, and the biggest users" },
        },
      )
      .post(
        "/organizations/:orgId/plan",
        async ({ admin, params, body }) => {
          const id = await assignPlanManually(ctx, params.orgId, body.planId, admin.userId);
          await ctx.db.transaction((tx) =>
            logActivity(tx, {
              organizationId: params.orgId,
              actorType: "admin",
              actorId: admin.userId,
              action: "plans.assign",
              resourceType: "subscription",
              resourceId: id,
              summary: `Put on the ${body.planId} Plan`,
            }),
          );
          return { subscriptionId: id };
        },
        { detail: { summary: "Put an Organization on a Plan with no payment" }, body: t.Object({ planId: t.String() }) },
      )
      .post(
        "/organizations/:orgId/overrides",
        async ({ admin, params, body }) => {
          await setOverride(ctx, params.orgId, body.key, body.value, body.reason, {
            expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
            by: admin.userId,
          });
          return { ok: true };
        },
        {
          detail: { summary: "Set an entitlement override for one Organization" },
          body: t.Object({
            key: t.String(),
            value: t.Union([t.Number(), t.Null()]),
            reason: t.String({ minLength: 1 }),
            expiresAt: t.Optional(t.Union([t.String(), t.Null()])),
          }),
        },
      ),
  );
  return new Elysia({ name: "billing" }).use(orgRoutes).use(webhooks).use(admin);
}

import { and, eq, inArray, sql } from "drizzle-orm";
import { appConfig, newId, emit, forbidden, invalid, notFound, type AppContext, type Tx, type Db, type UsageInput } from "@app/kernel";
import { entitlementOverrides, planEntitlements, planMeters, plans, planPrices, subscriptions, usageEvents } from "./schema";
import { mapStripeStatus, type BillingStatus } from "./providers";

export type { UsageInput };

export type PlanInput = {
  id: string;
  name: string;
  description?: string;
  sort?: number;
  active?: boolean;
  /** New Organizations (any with no Plan of their own) are on it. Setting it moves the default from another Plan; left out, unchanged. */
  default?: boolean;
  /** Entitlement keys and values: see ADR 0012. */
  entitlements: Record<string, number | null>;
  meters?: { meter: string; included: number | null; overage: "block" | "charge" | "byok_only"; unitPriceMicros?: number | null }[];
  prices?: { interval: "month" | "year"; amountCents: number; currency?: string; providerPriceId?: string | null }[];
};

/** An active Plan, or not found. */
async function activePlan(db: Db | Tx, planId: string) {
  const [plan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.active, true)));
  if (!plan) throw notFound("Plan");
  return plan;
}

/** Creates or replaces a Plan. Replacing keeps existing subscriptions; only the definition changes. */
/**
 * The Plan a new app starts with, so Organizations have entitlements from the first sign-up. Only into an empty table:
 * once any Plan exists, Plans are the admins' (Platform admin → Plans & usage) and this never touches them.
 * Returns whether it made one.
 */
export async function ensureFirstPlan(ctx: AppContext): Promise<boolean> {
  const [any] = await ctx.db.select({ id: plans.id }).from(plans).limit(1);
  if (any) return false;
  await upsertPlan(ctx, {
    id: "free",
    name: "Free",
    description: "Everything on, with monthly limits.",
    default: true,
    sort: 0,
    entitlements: Object.fromEntries(appConfig.features.map((f) => [`feature.${f.id}`, 1])),
    meters: [
      { meter: "llm.tokens", included: 200_000, overage: "block" },
      { meter: "email.sent", included: 100, overage: "block" },
    ],
  });
  return true;
}

export async function upsertPlan(ctx: AppContext, input: PlanInput): Promise<void> {
  if (!/^[a-z][a-z0-9-]{0,39}$/.test(input.id)) throw invalid("A Plan id is lowercase letters, digits and dashes.");
  await ctx.db.transaction(async (tx) => {
    const set = { name: input.name, description: input.description ?? "", sort: input.sort ?? 0, active: input.active ?? true };
    await tx
      .insert(plans)
      .values({ id: input.id, ...set })
      .onConflictDoUpdate({ target: plans.id, set: { ...set, updatedAt: new Date() } });
    if (input.default !== undefined) {
      if (input.default) await tx.update(plans).set({ isDefault: false }).where(eq(plans.isDefault, true));
      await tx.update(plans).set({ isDefault: input.default }).where(eq(plans.id, input.id));
    }
    await tx.delete(planEntitlements).where(eq(planEntitlements.planId, input.id));
    const ents = Object.entries(input.entitlements);
    if (ents.length) await tx.insert(planEntitlements).values(ents.map(([key, value]) => ({ planId: input.id, key, value })));
    await tx.delete(planMeters).where(eq(planMeters.planId, input.id));
    if (input.meters?.length) {
      await tx.insert(planMeters).values(
        input.meters.map((m) => ({
          planId: input.id,
          meter: m.meter,
          included: m.included,
          overage: m.overage,
          unitPriceMicros: m.unitPriceMicros ?? null,
        })),
      );
    }
    if (input.prices) {
      await tx.delete(planPrices).where(eq(planPrices.planId, input.id));
      if (input.prices.length)
        await tx.insert(planPrices).values(
          input.prices.map((p) => ({
            id: newId(),
            planId: input.id,
            interval: p.interval,
            amountCents: p.amountCents,
            currency: p.currency ?? "usd",
            providerPriceId: p.providerPriceId ?? null,
          })),
        );
    }
  });
}

/** Every Plan with what it grants and meters, and how many Organizations are on it: the platform admin area's Plans screen. */
export async function listPlans(ctx: AppContext) {
  const { rows } = await ctx.pool.query(
    `select p.id, p.name, p.description, p.active, p.sort, p.is_default as "isDefault",
            coalesce((select jsonb_object_agg(e.key, e.value) from billing.plan_entitlements e where e.plan_id = p.id), '{}'::jsonb) as entitlements,
            coalesce((select jsonb_agg(jsonb_build_object('meter', m.meter, 'included', m.included, 'overage', m.overage, 'unitPriceMicros', m.unit_price_micros) order by m.meter)
                        from billing.plan_meters m where m.plan_id = p.id), '[]'::jsonb) as meters,
            coalesce((select jsonb_agg(jsonb_build_object('interval', pr.interval, 'amountCents', pr.amount_cents, 'currency', pr.currency, 'providerPriceId', pr.provider_price_id) order by pr.interval)
                        from billing.plan_prices pr where pr.plan_id = p.id and pr.active), '[]'::jsonb) as prices,
            (select count(*)::int from billing.subscriptions s where s.plan_id = p.id and s.status in ('trialing','active','past_due')) as organizations
       from billing.plans p order by p.sort, p.name`,
  );
  return rows as {
    id: string;
    name: string;
    description: string;
    active: boolean;
    sort: number;
    isDefault: boolean;
    entitlements: Record<string, number | null>;
    meters: { meter: string; included: number | null; overage: "block" | "charge" | "byok_only"; unitPriceMicros: number | null }[];
    prices: { interval: "month" | "year"; amountCents: number; currency: string; providerPriceId: string | null }[];
    organizations: number;
  }[];
}

/** The active Plans an Organization may pick from (Settings → Billing), without internals. */
export async function publicPlans(ctx: AppContext) {
  return (await listPlans(ctx))
    .filter((p) => p.active)
    .map(({ id, name, description, isDefault, entitlements, prices }) => ({ id, name, description, isDefault, entitlements, prices }));
}

/** Assigns a Plan with no payment (the `manual` provider). Ends any live subscription first. */
export async function assignPlanManually(
  ctx: AppContext,
  orgId: string,
  planId: string,
  actorUserId: string | null = null,
): Promise<string> {
  return ctx.db.transaction(async (tx) => {
    await activePlan(tx, planId);
    await tx
      .update(subscriptions)
      .set({ status: "canceled", canceledAt: new Date(), updatedAt: new Date() })
      .where(and(eq(subscriptions.organizationId, orgId), inArray(subscriptions.status, ["trialing", "active", "past_due"])));
    const id = newId();
    await tx
      .insert(subscriptions)
      .values({ id, organizationId: orgId, planId, status: "active", provider: "manual", currentPeriodStart: new Date() });
    await emit(tx, { event: "subscription.changed", organizationId: orgId, payload: { planId, subscriptionId: id, by: actorUserId } });
    return id;
  });
}

/** Sets an override for one Organization (comps, extended trials, support changes). */
export async function setOverride(
  ctx: AppContext,
  orgId: string,
  key: string,
  value: number | null,
  reason: string,
  opts: { expiresAt?: Date | null; by?: string | null } = {},
) {
  await ctx.db
    .insert(entitlementOverrides)
    .values({ organizationId: orgId, key, value, reason, expiresAt: opts.expiresAt ?? null, createdBy: opts.by ?? null })
    .onConflictDoUpdate({
      target: [entitlementOverrides.organizationId, entitlementOverrides.key],
      set: { value, reason, expiresAt: opts.expiresAt ?? null, createdBy: opts.by ?? null, createdAt: new Date() },
    });
}

/** Records one metered call. Works with the app's connection or inside a transaction. */
export async function recordUsage(db: Db | Tx, input: UsageInput): Promise<void> {
  await db.insert(usageEvents).values({
    id: newId(),
    organizationId: input.organizationId,
    meter: input.meter,
    quantity: input.quantity,
    costMicros: input.costMicros,
    provider: input.provider,
    mode: input.mode,
    runId: input.runId ?? null,
    meta: input.meta ?? null,
  });
}

/** What a Run cost: the sum of the usage it caused (usage_events.run_id). */
export async function costOfRun(ctx: AppContext, runId: string): Promise<number> {
  const [cost] = await ctx.db
    .select({ total: sql<number>`coalesce(sum(${usageEvents.costMicros}), 0)::bigint` })
    .from(usageEvents)
    .where(eq(usageEvents.runId, runId));
  return Number(cost?.total ?? 0);
}

/** Stripe sends Unix seconds; null or missing means "not set". */
const toDate = (u?: number | null) => (u ? new Date(u * 1000) : null);

/** Applies a Stripe subscription event. Pure database work, so it can be replayed safely. */
export async function applyStripeSubscription(
  ctx: AppContext,
  s: {
    id: string;
    status: string;
    metadata?: { orgId?: string };
    current_period_start?: number;
    current_period_end?: number;
    canceled_at?: number | null;
    cancel_at?: number | null;
  },
  planId?: string,
): Promise<BillingStatus> {
  const status = mapStripeStatus(s.status);
  const [existing] = await ctx.db.select().from(subscriptions).where(eq(subscriptions.providerSubscriptionId, s.id));
  if (existing) {
    await ctx.db
      .update(subscriptions)
      .set({
        status,
        currentPeriodStart: toDate(s.current_period_start) ?? existing.currentPeriodStart,
        currentPeriodEnd: toDate(s.current_period_end) ?? existing.currentPeriodEnd,
        canceledAt: toDate(s.canceled_at),
        cancelAt: toDate(s.cancel_at),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, existing.id));
    return status;
  }
  const orgId = s.metadata?.orgId;
  if (!orgId || !planId) throw forbidden("Unknown subscription and no organization to attach it to.");
  await activePlan(ctx.db, planId);
  await ctx.db.insert(subscriptions).values({
    id: newId(),
    organizationId: orgId,
    planId,
    status,
    provider: "stripe",
    providerSubscriptionId: s.id,
    currentPeriodStart: toDate(s.current_period_start),
    currentPeriodEnd: toDate(s.current_period_end),
  });
  return status;
}

/**
 * Starts a Stripe subscription for an Organization on a Plan. The subscription is stored as `incomplete` until
 * Stripe's webhook says otherwise. The Stripe client is passed in so tests can run without network access.
 */
export async function startStripeCheckout(
  ctx: AppContext,
  client: import("./providers").StripeClient,
  input: { orgId: string; planId: string; email: string },
): Promise<{ subscriptionId: string; status: string }> {
  await activePlan(ctx.db, input.planId);
  const [price] = await ctx.db
    .select()
    .from(planPrices)
    .where(and(eq(planPrices.planId, input.planId), eq(planPrices.interval, "month"), eq(planPrices.active, true)));
  if (!price?.providerPriceId) throw invalid("This plan has no Stripe price yet.");

  const [existing] = await ctx.db
    .select({ customer: subscriptions.providerCustomerId })
    .from(subscriptions)
    .where(and(eq(subscriptions.organizationId, input.orgId), eq(subscriptions.provider, "stripe")))
    .limit(1);
  const customerId = existing?.customer ?? (await client.createCustomer({ email: input.email, orgId: input.orgId })).id;
  const sub = await client.createSubscription({
    customerId,
    priceId: price.providerPriceId,
    orgId: input.orgId,
    planId: input.planId,
  } as never);
  const status = await applyStripeSubscription(ctx, { ...sub, metadata: { orgId: input.orgId } }, input.planId);
  await ctx.db
    .update(subscriptions)
    .set({ providerCustomerId: customerId, priceId: price.id })
    .where(eq(subscriptions.providerSubscriptionId, sub.id));
  return { subscriptionId: sub.id, status };
}

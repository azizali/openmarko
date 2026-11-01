import { and, eq, inArray } from "drizzle-orm";
import { newId, emit, forbidden, invalid, notFound, type AppContext, type Tx, type Db } from "@openmarko/kernel";
import { entitlementOverrides, planEntitlements, planMeters, plans, planPrices, subscriptions, usageEvents } from "./schema";
import { mapStripeStatus, type BillingStatus } from "./providers";

export type PlanInput = {
  id: string;
  name: string;
  sort?: number;
  /** Entitlement keys and values: see ADR 0012. */
  entitlements: Record<string, number | null>;
  meters?: { meter: string; included: number | null; overage: "block" | "charge" | "byok_only"; unitPriceMicros?: number | null }[];
  prices?: { interval: "month" | "year"; amountCents: number; currency?: string; providerPriceId?: string | null }[];
};

/** Creates or replaces a Plan. Replacing keeps existing subscriptions; only the definition changes. */
export async function upsertPlan(ctx: AppContext, input: PlanInput): Promise<void> {
  await ctx.db.transaction(async (tx) => {
    await tx
      .insert(plans)
      .values({ id: input.id, name: input.name, sort: input.sort ?? 0 })
      .onConflictDoUpdate({ target: plans.id, set: { name: input.name, sort: input.sort ?? 0, updatedAt: new Date() } });
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
    if (input.prices?.length) {
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

/** Assigns a Plan with no payment (the `manual` provider). Ends any live subscription first. */
export async function assignPlanManually(
  ctx: AppContext,
  orgId: string,
  planId: string,
  actorUserId: string | null = null,
): Promise<string> {
  return ctx.db.transaction(async (tx) => {
    const [plan] = await tx.select({ id: plans.id, active: plans.active }).from(plans).where(eq(plans.id, planId));
    if (!plan || !plan.active) throw notFound("Plan");
    await tx
      .update(subscriptions)
      .set({ status: "canceled", canceledAt: new Date(), updatedAt: new Date() })
      .where(and(eq(subscriptions.organizationId, orgId), inArray(subscriptions.status, ["trialing", "active", "past_due"])));
    const id = newId();
    await tx.insert(subscriptions).values({
      id,
      organizationId: orgId,
      planId,
      status: "active",
      provider: "manual",
      currentPeriodStart: new Date(),
    });
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

export type UsageInput = {
  organizationId: string;
  meter: string;
  quantity: number;
  costMicros: number;
  provider: string;
  mode: "live" | "stub";
  runId?: string | null;
  meta?: Record<string, unknown> | null;
};

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

/** Applies a Stripe subscription event. Pure database work, so it can be replayed safely. */
/** Stripe sends Unix seconds; null or missing means "not set". */
const toDate = (u?: number | null) => (u ? new Date(u * 1000) : null);

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
  const [plan] = await ctx.db.select().from(plans).where(eq(plans.id, input.planId));
  if (!plan || !plan.active) throw notFound("Plan");
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

// Entitlements for an Organization: its Plan (or its Partner's Plan), then the overrides on top (ADR 0012).
import { and, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { authOrganization, planLimit, type AppContext } from "@openmarko/kernel";
import { entitlementOverrides, planEntitlements, planMeters, subscriptions } from "./schema";

/** key → value. A missing key means: features are off, actions are allowed, limits are unlimited. */
export type Entitlements = Map<string, number | null>;

const LIVE = ["trialing", "active", "past_due"];

async function liveSubscriptionPlan(ctx: AppContext, orgId: string): Promise<string | null> {
  const [s] = await ctx.db
    .select({ planId: subscriptions.planId })
    .from(subscriptions)
    .where(and(eq(subscriptions.organizationId, orgId), inArray(subscriptions.status, LIVE)))
    .limit(1);
  return s?.planId ?? null;
}

/** The Plan that applies: the Organization's own, else its Partner's (a Client's Partner covers it). */
export async function planIdFor(ctx: AppContext, orgId: string): Promise<string | null> {
  const own = await liveSubscriptionPlan(ctx, orgId);
  if (own) return own;
  const [org] = await ctx.db.select({ partnerId: authOrganization.partnerId }).from(authOrganization).where(eq(authOrganization.id, orgId));
  if (!org?.partnerId) return null;
  return liveSubscriptionPlan(ctx, org.partnerId);
}

export async function entitlementsFor(ctx: AppContext, orgId: string): Promise<Entitlements> {
  const out: Entitlements = new Map();
  const planId = await planIdFor(ctx, orgId);
  if (planId) {
    const rows = await ctx.db.select().from(planEntitlements).where(eq(planEntitlements.planId, planId));
    for (const r of rows) out.set(r.key, r.value);
  }
  const overrides = await ctx.db
    .select()
    .from(entitlementOverrides)
    .where(
      and(
        eq(entitlementOverrides.organizationId, orgId),
        or(isNull(entitlementOverrides.expiresAt), gt(entitlementOverrides.expiresAt, sql`now()`)),
      ),
    );
  for (const o of overrides) out.set(o.key, o.value);
  return out;
}

export const featureAllowedByPlan = (ent: Entitlements, feature: string) => ent.get(`feature.${feature}`) === 1;

/** Limit check before adding something. Throws planLimit when the count is at the limit. */
export function checkLimit(ent: Entitlements, key: string, current: number): void {
  const limit = ent.has(`limit.${key}`) ? ent.get(`limit.${key}`) : null;
  if (limit !== null && limit !== undefined && current >= limit) throw planLimit(`limit.${key}`);
}

/**
 * Metered use (ADR 0012). `byok` means the call uses the Organization's own key.
 * Throws planLimit when the Plan blocks the use. Returns what the call is charged beyond the allowance.
 */
export async function assertMeterAllowed(
  ctx: AppContext,
  orgId: string,
  meter: string,
  quantity: number,
  opts: { byok: boolean },
): Promise<{ overageUnits: number; overagePriceMicros: number }> {
  const planId = await planIdFor(ctx, orgId);
  if (!planId) throw planLimit(`meter.${meter}`);
  const [rule] = await ctx.db
    .select()
    .from(planMeters)
    .where(and(eq(planMeters.planId, planId), eq(planMeters.meter, meter)));
  // A meter the Plan doesn't mention is not sold: it is blocked unless the Organization brings its own key.
  if (!rule) {
    if (opts.byok) return { overageUnits: 0, overagePriceMicros: 0 };
    throw planLimit(`meter.${meter}`);
  }
  if (rule.overage === "byok_only" && !opts.byok) throw planLimit(`meter.${meter}`);
  if (rule.included === null) return { overageUnits: 0, overagePriceMicros: 0 };
  const used = await meteredInPeriod(ctx, orgId, meter);
  const over = Math.max(0, used + quantity - rule.included);
  if (over === 0) return { overageUnits: 0, overagePriceMicros: 0 };
  if (rule.overage === "block") throw planLimit(`meter.${meter}`);
  if (rule.overage === "byok_only") return { overageUnits: over, overagePriceMicros: 0 };
  return { overageUnits: over, overagePriceMicros: (rule.unitPriceMicros ?? 0) * over };
}

/** Units used this period (the current month, until subscriptions carry their own period). */
export async function meteredInPeriod(ctx: AppContext, orgId: string, meter: string): Promise<number> {
  const rows = await ctx.db.execute<{ total: string | null }>(sql`
    select coalesce(sum(quantity), 0)::text as total
    from billing.usage_events
    where organization_id = ${orgId} and meter = ${meter}
      and occurred_at >= date_trunc('month', now())`);
  return Number(rows.rows[0]?.total ?? 0);
}

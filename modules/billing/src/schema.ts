// Billing tables (schema.md, billing). Plans are rows: the owner defines them, no code knows their names (ADR 0012).
import { sql } from "drizzle-orm";
import { bigint, boolean, index, integer, pgSchema, primaryKey, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { authOrganization } from "@openmarko/kernel";

export const billing = pgSchema("billing");

export const plans = billing.table("plans", {
  id: text("id").primaryKey(), // any id the owner chooses, e.g. 'starter', 'growth'
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const planPrices = billing.table(
  "plan_prices",
  {
    id: uuid("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id),
    interval: text("interval").notNull(), // 'month' | 'year'
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    providerPriceId: text("provider_price_id"), // Stripe price id; null for manual-only plans
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("plan_prices_plan").on(t.planId)],
);

/** Entitlements: `feature.<id>` = 1/0, `action.<resource>.<action>` = 0 to remove, `limit.<name>` = number (NULL = unlimited), `partner` = 1/0. */
export const planEntitlements = billing.table(
  "plan_entitlements",
  {
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: bigint("value", { mode: "number" }),
  },
  (t) => [primaryKey({ columns: [t.planId, t.key] })],
);

/** How each metered use is sold, per Plan (ADR 0012). */
export const planMeters = billing.table(
  "plan_meters",
  {
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    meter: text("meter").notNull(),
    included: bigint("included", { mode: "number" }), // units per period; NULL = unlimited
    overage: text("overage").notNull(), // 'block' | 'charge' | 'byok_only'
    unitPriceMicros: bigint("unit_price_micros", { mode: "number" }),
  },
  (t) => [primaryKey({ columns: [t.planId, t.meter] })],
);

export const subscriptions = billing.table(
  "subscriptions",
  {
    id: uuid("id").primaryKey(),
    // Who pays: an Organization, or a Partner (whose Plan covers its Clients).
    organizationId: text("organization_id")
      .notNull()
      .references(() => authOrganization.id, { onDelete: "cascade" }),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id),
    priceId: uuid("price_id"),
    status: text("status").notNull(), // 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'
    provider: text("provider").notNull(), // 'stripe' | 'manual'
    providerCustomerId: text("provider_customer_id"),
    providerSubscriptionId: text("provider_subscription_id").unique(),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAt: timestamp("cancel_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("subscriptions_org").on(t.organizationId, t.status)],
);

export const entitlementOverrides = billing.table(
  "entitlement_overrides",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => authOrganization.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: bigint("value", { mode: "number" }),
    reason: text("reason").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.key] })],
);

/** One row per metered call to a paid provider (ADR 0012). Partitioned by month in the migration SQL. */
export const usageEvents = billing.table(
  "usage_events",
  {
    id: uuid("id").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => authOrganization.id, { onDelete: "cascade" }),
    meter: text("meter").notNull(),
    quantity: bigint("quantity", { mode: "number" }).notNull(),
    costMicros: bigint("cost_micros", { mode: "number" }).notNull(),
    provider: text("provider").notNull(),
    mode: text("mode").notNull(), // 'live' | 'stub'
    runId: uuid("run_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    meta: jsonb("meta").$type<Record<string, unknown> | null>(),
  },
  (t) => [primaryKey({ columns: [t.id, t.occurredAt] }), index("usage_org_meter").on(t.organizationId, t.meter, t.occurredAt)],
);

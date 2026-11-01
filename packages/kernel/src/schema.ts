// Tables the kernel owns (core.outbox, core.activity and their bookkeeping). Module tables live in each module's schema.ts.
import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authOrganization } from "./auth-refs";

export const core = pgSchema("core");
export const outbox = core.table(
  "outbox",
  {
    id: uuid("id").primaryKey(),
    event: text("event").notNull(),
    organizationId: text("organization_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    availableAt: timestamp("available_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("outbox_pending")
      .on(t.availableAt)
      .where(sql`processed_at is null`),
  ],
);

/** Which handler has already run for which event. Makes repeated delivery harmless (ADR 0009). */
export const outboxHandled = core.table(
  "outbox_handled",
  {
    eventId: uuid("event_id").notNull(),
    handler: text("handler").notNull(),
    handledAt: timestamp("handled_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.handler] })],
);

/**
 * Who did what (schema.md, core.activity). Every module that changes something writes a row here,
 * in the same transaction as the change. Partitioned by month in the migration SQL.
 */
export const activity = core.table(
  "activity",
  {
    id: uuid("id").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => authOrganization.id, { onDelete: "cascade" }),
    actorType: text("actor_type").notNull(), // 'member' | 'assistant' | 'system' | 'partner_staff'
    actorId: text("actor_id"),
    action: text("action").notNull(), // the Action id, e.g. 'reviews.post'
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id"),
    locationId: uuid("location_id"),
    summary: text("summary").notNull(),
    data: jsonb("data").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [primaryKey({ columns: [t.id, t.createdAt] }), index("activity_org_time").on(t.organizationId, t.createdAt)],
);

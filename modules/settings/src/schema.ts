import { sql } from "drizzle-orm";
import { integer, jsonb, pgSchema, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const core = pgSchema("core");

/**
 * Settings that aren't columns: one JSON blob per (scope, namespace), validated by the module that owns the namespace.
 * `version` is for optimistic locking: an update must name the version it read.
 */
export const settings = core.table(
  "settings",
  {
    scopeType: text("scope_type").notNull(), // 'user' | 'organization' | 'partner' | 'location' | 'website' | 'platform'
    scopeId: text("scope_id").notNull(),
    namespace: text("namespace").notNull(),
    value: jsonb("value").$type<unknown>().notNull(),
    version: integer("version").notNull().default(1),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [primaryKey({ columns: [t.scopeType, t.scopeId, t.namespace] })],
);

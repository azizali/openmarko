import { sql } from "drizzle-orm";
import { integer, jsonb, pgSchema, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const core = pgSchema("core");

/**
 * Settings that aren't columns: one JSON record per (scope, namespace), checked against the schema the owning
 * module declares in its manifest. A new setting or a changed one needs no migration.
 * `version` is for optimistic locking: an update must name the version it read.
 */
export const settings = core.table(
  "settings",
  {
    scopeType: text("scope_type").notNull(), // 'app' | 'organization' | 'partner' | 'user'
    scopeId: text("scope_id").notNull(), // 'app', or the Organization or user id
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

import { sql } from "drizzle-orm";
import { index, jsonb, pgSchema, text, timestamp, uuid, uniqueIndex, customType } from "drizzle-orm/pg-core";
import { authOrganization } from "@app/kernel";

export const integrations = pgSchema("integrations");

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/**
 * A connected instance of a Provider (ADR 0002). Organization-owned (target 'organization' or 'partner'), or the
 * app's own (target 'app', no Organization): the default model key, the email provider, an account every
 * Organization without its own uses.
 */
export const connections = integrations.table(
  "connections",
  {
    id: uuid("id").primaryKey(),
    organizationId: text("organization_id").references(() => authOrganization.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull(),
    targetType: text("target_type").notNull(), // 'app' | 'partner' | 'organization'
    targetId: text("target_id"), // the Organization's id; null for 'app'
    externalId: text("external_id"), // the provider's id for it, if any
    label: text("label").notNull(),
    status: text("status").notNull().default("ok"), // 'ok' | 'action' | 'pending' | 'revoked'
    statusNote: text("status_note"),
    capabilities: text("capabilities").array().notNull(),
    // Non-secret values from the provider's fields (host, region…). Secrets go to credentials.
    settings: jsonb("settings")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    mode: text("mode").notNull(), // 'live' | 'stub'
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    index("connections_org_target")
      .on(t.organizationId, t.targetType, t.targetId)
      .where(sql`revoked_at is null`),
    uniqueIndex("connections_external")
      .on(t.providerId, t.externalId, t.targetId)
      .where(sql`revoked_at is null`),
  ],
);

/** Envelope-encrypted secrets, apart from the Connection (ADR 0010). Only adapters decrypt. */
export const credentials = integrations.table("credentials", {
  connectionId: uuid("connection_id")
    .primaryKey()
    .references(() => connections.id, { onDelete: "cascade" }),
  organizationId: text("organization_id"),
  ciphertext: bytea("ciphertext").notNull(),
  wrappedKey: bytea("wrapped_key").notNull(),
  keyVersion: text("key_version").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  rotatedAt: timestamp("rotated_at", { withTimezone: true }),
});

/** Raw inbound webhooks: stored first, so duplicates are dropped and events can be replayed (ADR 0009). */
export const webhookEvents = integrations.table(
  "webhook_events",
  {
    id: uuid("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    externalId: text("external_id").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => [uniqueIndex("webhook_events_external").on(t.providerId, t.externalId)],
);

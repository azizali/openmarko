import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgSchema, text, timestamp, uuid, uniqueIndex, customType } from "drizzle-orm/pg-core";
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

/**
 * A provider's untrimmed response, kept as a gzipped JSON file in the file store (ADR 0035): what's there to read
 * later that we don't read yet. One row per response, so a file is found by the provider's own id for it, and
 * dropped after `PROVIDER_ORIGINALS_DAYS`.
 */
export const providerOriginals = integrations.table(
  "provider_originals",
  {
    id: uuid("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    capability: text("capability").notNull(),
    /** The provider's own id for the response (DataForSEO: the task id). */
    ref: text("ref").notNull(),
    /** Whose call it was; null for the app's own, or once the Organization is gone. */
    organizationId: text("organization_id").references(() => authOrganization.id, { onDelete: "set null" }),
    fileKey: text("file_key").notNull(),
    bytes: integer("bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("provider_originals_ref").on(t.providerId, t.ref), index("provider_originals_created").on(t.createdAt)],
);

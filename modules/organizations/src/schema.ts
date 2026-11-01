import { sql } from "drizzle-orm";
import { boolean, doublePrecision, index, pgSchema, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { authOrganization } from "@openmarko/kernel";

export const core = pgSchema("core");

/**
 * A physical place. A Location holds its Google Business Profile id (unique: a profile belongs to one Location).
 * Without a profile a Location is inert: pages show Connect, jobs skip it (ADR 0011, schema.md).
 */
export const locations = core.table(
  "locations",
  {
    id: uuid("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => authOrganization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    region: text("region"),
    postalCode: text("postal_code"),
    country: text("country").notNull().default("US"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    phone: text("phone"),
    timezone: text("timezone"),
    placeId: text("place_id"),
    gbpId: text("gbp_id"), // "locations/1234567890"
    gbpConnectionId: uuid("gbp_connection_id"),
    websiteUrl: text("website_url"), // the link on the Google Business Profile; shown, never audited
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    index("locations_org")
      .on(t.organizationId)
      .where(sql`archived_at is null`),
    uniqueIndex("locations_gbp_id")
      .on(t.gbpId)
      .where(sql`gbp_id is not null`),
  ],
);

/** A domain the Organization owns. Independent of Locations (ADR 0011). Audits run per domain, never per page. */
export const websites = core.table(
  "websites",
  {
    id: uuid("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => authOrganization.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(), // lowercase host, no scheme: "mapleandmain.com"
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex("websites_org_domain").on(t.organizationId, t.domain)],
);

/** A Partner's request to take a Client on. The Client's owner accepts or declines (ADR 0011). */
export const partnerRequests = core.table(
  "partner_requests",
  {
    id: uuid("id").primaryKey(),
    partnerId: text("partner_id")
      .notNull()
      .references(() => authOrganization.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => authOrganization.id, { onDelete: "cascade" }),
    status: text("status").notNull(), // 'pending' | 'accepted' | 'declined' | 'withdrawn'
    requestedBy: text("requested_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("partner_requests_pending")
      .on(t.partnerId, t.clientId)
      .where(sql`status = 'pending'`),
  ],
);

/** A host that shows a Partner's brand (whitelabel, ADR 0004). Looked up on every request. */
export const domains = core.table("domains", {
  host: text("host").primaryKey(),
  partnerId: text("partner_id")
    .notNull()
    .references(() => authOrganization.id, { onDelete: "cascade" }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

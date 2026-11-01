// References to Better Auth's tables. Column names are Better Auth's own (camelCase), not ours.
// References to Better Auth's tables (created by modules/identity, not by Drizzle).
// This file is deliberately outside drizzle.config's schema glob: Drizzle must never create or alter these.
// Tenant tables point at them so they cascade on delete (schema.md, Archive and delete).
import { jsonb, pgSchema, text, timestamp } from "drizzle-orm/pg-core";

export const authSchema = pgSchema("auth");

/**
 * A reference to Better Auth's organization table (owned by identity, created by its migration).
 * Drizzle doesn't create it: `auth` is outside drizzle.config's schemaFilter. It exists so tenant
 * tables can cascade on delete (schema.md, Archive and delete).
 */
export const authOrganization = authSchema.table("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  category: text("category"),
  timezone: text("timezone"),
  partnerId: text("partnerId"),
  features: jsonb("features").$type<Record<string, boolean>>(),
  archivedAt: timestamp("archivedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }),
});

/** Better Auth's member rows: the only thing that grants access to an Organization (ADR 0011). */
export const authMember = authSchema.table("member", {
  id: text("id").primaryKey(),
  organizationId: text("organizationId").notNull(),
  userId: text("userId").notNull(),
  role: text("role").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
});

/** Better Auth's custom Roles. `permission` is the compiled grant; `spec` is what the editor reopens (ADR 0003). */
export const authOrganizationRole = authSchema.table("organizationRole", {
  id: text("id").primaryKey(),
  organizationId: text("organizationId").notNull(),
  role: text("role").notNull(),
  permission: text("permission").notNull(),
  spec: jsonb("spec"),
});

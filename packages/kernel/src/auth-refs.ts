// References to Better Auth's tables (created by modules/identity, not by Drizzle). Column names are Better Auth's
// own (camelCase), not ours. This file is deliberately outside drizzle.config's schema glob: Drizzle must never
// create or alter these. Our tables point at them so they cascade on delete (schema.md, Archive and delete).
import { boolean, jsonb, pgSchema, text, timestamp } from "drizzle-orm/pg-core";

export const authSchema = pgSchema("auth");

/** Better Auth's organization table (owned by identity, created by its migration). */
export const authOrganization = authSchema.table("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
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

/** Better Auth's users. Only the columns our code reads. `role` is the admin plugin's: 'admin' or 'user'. */
export const authUser = authSchema.table("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  emailVerified: boolean("emailVerified").notNull(),
  role: text("role"),
  banned: boolean("banned"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
});

/** Better Auth's invitations (the organization plugin). */
export const authInvitation = authSchema.table("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organizationId").notNull(),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").notNull(),
  inviterId: text("inviterId").notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }),
});

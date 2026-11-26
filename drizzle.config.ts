import { defineConfig } from "drizzle-kit";

// Migrations are generated from every module's schema (`bun run db:generate`, from the repository root).
// Better Auth's `auth` schema is created by its own migration (modules/identity), so it's excluded here: its tables
// are referenced, never created, by Drizzle.
export default defineConfig({
  dialect: "postgresql",
  schema: ["./modules/*/src/schema.ts", "./packages/kernel/src/schema.ts"],
  out: "./packages/kernel/drizzle",
  schemaFilter: ["core", "billing", "integrations", "automation", "ai", "knowledge", "seo"],
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://postgres:dev@localhost:5433/app" },
});

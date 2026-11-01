// Better Auth, self-hosted (ADR 0003, ADR 0007). Its tables live in the `auth` schema.
// Organizations, Members and custom Roles come from its organization plugin, with
// dynamic access control so each Organization can have its own Roles.
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";
import { compile, presets, statement } from "@openmarko/shared";
import type { Config } from "@openmarko/kernel";

export const authSchemaName = "auth";

/** A pool whose default schema is `auth`, so Better Auth's unqualified table names resolve there. */
export function createAuthPool(databaseUrl: string): Pool {
  return new Pool({ connectionString: databaseUrl, max: 5, options: `-c search_path=${authSchemaName}` });
}

const ac = createAccessControl(statement);
const presetRoles = Object.fromEntries(presets.map((p) => [p.id, ac.newRole(compile(p) as any)]));

export type Auth = ReturnType<typeof createAuth>;

export function createAuth(cfg: Pick<Config, "authSecret" | "authUrl" | "trustedOrigins">, pool: Pool) {
  return betterAuth({
    database: pool,
    secret: cfg.authSecret,
    baseURL: cfg.authUrl,
    trustedOrigins: [cfg.authUrl, ...cfg.trustedOrigins],
    basePath: "/api/auth",
    advanced: {
      // UUIDv7 ids everywhere, so our tenant tables can reference them as uuid (schema.md conventions).
      database: { generateId: () => Bun.randomUUIDv7() },
    },
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    plugins: [
      organization({
        ac,
        roles: presetRoles as any,
        dynamicAccessControl: { enabled: true },
        creatorRole: "owner",
        schema: {
          organization: {
            additionalFields: {
              // Organization facts the rest of the app reads on every request (schema.md).
              category: { type: "string", required: false, input: true },
              timezone: { type: "string", required: false, defaultValue: "UTC", input: true },
              // Partner link: a Client points at its Partner's Organization (ADR 0011). Server-set only.
              partnerId: { type: "string", required: false, input: false },
              // Feature switches: { "rankings": false }. Missing key = on (ADR 0006). Server-set only.
              features: { type: "json", required: false, input: false },
              archivedAt: { type: "date", required: false, input: false },
            },
          },
          organizationRole: {
            additionalFields: {
              // The RoleSpec the role editor reopens (ADR 0003). Server-set only.
              spec: { type: "json", required: false, input: false },
            },
          },
        },
      }),
    ],
  });
}

/** Creates Better Auth's tables in the auth schema. Run before the Drizzle migrations. */
export async function migrateAuth(cfg: Pick<Config, "databaseUrl" | "authSecret" | "authUrl" | "trustedOrigins">): Promise<void> {
  const pool = createAuthPool(cfg.databaseUrl);
  try {
    await pool.query(`create schema if not exists ${authSchemaName}`);
    const auth = createAuth(cfg, pool);
    const { runMigrations } = await getMigrations(auth.options);
    await runMigrations();
  } finally {
    await pool.end();
  }
}

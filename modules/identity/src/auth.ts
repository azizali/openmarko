// Better Auth, self-hosted (ADR 0003, ADR 0007): one instance for the app. Its tables live in the `auth` schema.
// Organizations, Members and custom Roles come from its organization plugin, with dynamic access control so each
// Organization can have its own Roles. The admin plugin marks app admins (user.role = 'admin'). Sign-in methods
// follow app.config.ts and the environment: Google turns on with its client id and secret, magic links with the
// config switch; email and password are always on.
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { admin, magicLink, organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { kyselyAdapter } from "@better-auth/kysely-adapter";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { appConfig, type AccessCatalog, type Config } from "@app/kernel";
import { presetPermissions, statementOf } from "@app/shared";

export const authSchemaName = "auth";

/** A pool whose default schema is `auth`, so Better Auth's unqualified table names resolve there. */
export function createAuthPool(databaseUrl: string): Pool {
  return new Pool({ connectionString: databaseUrl, max: 5, options: `-c search_path=${authSchemaName}` });
}

type AuthConfig = Pick<Config, "authSecret" | "authUrl" | "appUrl" | "trustedOrigins" | "google" | "adminEmails">;

export type Mailer = (
  template: "verify-email" | "reset-password" | "magic-link" | "invitation",
  to: string,
  data: Record<string, string>,
) => Promise<boolean>;

/** What the instance is built with besides the config: the catalog's resources (Roles) and how to email. */
export type AuthDeps = {
  access: AccessCatalog;
  /** Sends one of the app's emails (messaging). Absent, or false back, when the app can't send yet. */
  mail?: Mailer;
};

/** Which sign-in methods are on. The sign-in page renders from this (GET /api/v1/auth/methods). */
export function authMethods(cfg: Pick<Config, "google">) {
  return {
    emailAndPassword: true,
    google: cfg.google !== null,
    magicLink: appConfig.auth.magicLink,
    openSignUp: appConfig.auth.openSignUp,
    verifyEmail: appConfig.auth.verifyEmail,
  };
}

/** Better Auth's access control: the statement from the catalog, and the preset Roles compiled against it. */
function accessControl(access: AccessCatalog) {
  const ac = createAccessControl(statementOf(access));
  const roles = Object.fromEntries(Object.entries(presetPermissions(access)).map(([id, p]) => [id, ac.newRole(p as any)]));
  return { ac, roles };
}

const NO_ACCESS: AccessCatalog = { resources: [], groups: [] };

/** Everything about the instance except its database. */
function options(cfg: AuthConfig, deps: AuthDeps) {
  const { ac, roles } = accessControl(deps.access);
  const mail: Mailer = (template, to, data) => deps.mail?.(template, to, data) ?? Promise.resolve(false);
  const admins = new Set(cfg.adminEmails);
  return {
    appName: appConfig.name,
    baseURL: cfg.authUrl,
    basePath: "/api/auth",
    secret: cfg.authSecret,
    trustedOrigins: cfg.trustedOrigins,
    advanced: {
      // Better Auth skips its origin check when it detects a test run; on, so tests check what production does.
      disableOriginCheck: false,
      // UUIDv7 ids everywhere, so our tables can reference them as uuid (schema.md conventions).
      database: { generateId: () => Bun.randomUUIDv7() },
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: !appConfig.auth.openSignUp,
      minPasswordLength: 8,
      sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) =>
        void (await mail("reset-password", user.email, { url })),
    },
    emailVerification: {
      sendOnSignUp: appConfig.auth.verifyEmail,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) =>
        void (await mail("verify-email", user.email, { url })),
    },
    ...(cfg.google ? { socialProviders: { google: { clientId: cfg.google.clientId, clientSecret: cfg.google.clientSecret } } } : {}),
    databaseHooks: {
      user: {
        create: {
          // Anyone listed in ADMIN_EMAILS is an app admin from the moment they sign up.
          before: async (user: { email: string; role?: string }) => ({
            data: { ...user, role: admins.has(user.email.toLowerCase()) ? "admin" : (user.role ?? "user") },
          }),
        },
      },
    },
    plugins: [
      admin({ defaultRole: "user", adminRoles: ["admin"] }),
      organization({
        // The link needs the app's address; messaging builds it from appUrl.
        sendInvitationEmail: async (inv: {
          id: string;
          email: string;
          role: string;
          organization: { name: string };
          inviter: { user: { name: string } };
        }) =>
          void (await mail("invitation", inv.email, {
            invitationId: inv.id,
            organization: inv.organization.name,
            inviter: inv.inviter.user.name,
            role: inv.role,
          })),
        ac,
        roles: roles as any,
        dynamicAccessControl: { enabled: true },
        creatorRole: "owner",
        schema: {
          organization: {
            additionalFields: {
              // Organization facts the rest of the app reads on every request (schema.md).
              timezone: { type: "string", required: false, defaultValue: "UTC", input: true },
              // Partner link: a Client points at its Partner's Organization (ADR 0011). Server-set only.
              partnerId: { type: "string", required: false, input: false },
              // Feature switches: { "assistant": false }. Missing key = on (ADR 0006). Server-set only.
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
      ...(appConfig.auth.magicLink
        ? [
            magicLink({
              disableSignUp: !appConfig.auth.openSignUp,
              sendMagicLink: async ({ email, url }) => void (await mail("magic-link", email, { url })),
            }),
          ]
        : []),
    ],
  } satisfies BetterAuthOptions;
}

export type Auth = ReturnType<typeof createAuth>;

/** The Better Auth instance, over a Kysely on the auth pool. */
export function createAuth(cfg: AuthConfig, pool: Pool, deps: AuthDeps) {
  const db = new Kysely<any>({ dialect: new PostgresDialect({ pool }) });
  return betterAuth({ ...options(cfg, deps), database: kyselyAdapter(db, { type: "postgres", transaction: true }) });
}

/** Creates or updates Better Auth's tables in the auth schema. Safe to rerun. */
export async function migrateAuth(cfg: AuthConfig & Pick<Config, "databaseUrl">): Promise<void> {
  const pool = createAuthPool(cfg.databaseUrl);
  try {
    await pool.query(`create schema if not exists ${authSchemaName}`);
    // The statement only shapes Roles, never tables; migrations need the plugins' tables, which don't depend on it.
    const { runMigrations } = await getMigrations({ ...options(cfg, { access: NO_ACCESS }), database: pool });
    await runMigrations();
  } finally {
    await pool.end();
  }
}

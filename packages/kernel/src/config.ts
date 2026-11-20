import { z } from "zod";
import { appConfig, type OptionalModule } from "../../../app.config";

// The one place that reads the environment. Everything else gets a typed Config.
// Loading fails fast, listing every problem at once, so a bad deploy stops at boot instead of on the first request.

/** Modules every app runs: you can't sign in, belong to an Organization or store a setting without them. */
export const coreModules = ["identity", "organizations", "access", "features", "settings", "integrations", "messaging"] as const;
export type CoreModule = (typeof coreModules)[number];
export type ModuleId = CoreModule | OptionalModule;
export const allModules: ModuleId[] = [...coreModules, ...(Object.keys(appConfig.modules) as OptionalModule[])];

/** The modules app.config.ts turns on: every core module, plus each optional one set to true. */
export const configuredModules = (): ModuleId[] => [
  ...coreModules,
  ...(Object.entries(appConfig.modules) as [OptionalModule, boolean][]).filter(([, on]) => on).map(([id]) => id),
];

const csv = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const postgresUrl = z
  .string()
  .min(1)
  .refine((v) => /^postgres(ql)?:\/\//.test(v), "must be a postgres:// or postgresql:// URL");

const base64Key = z
  .string()
  .refine((v) => Buffer.from(v, "base64").length === 32, "must be 32 random bytes, base64-encoded (openssl rand -base64 32)");

const origin = z.string().refine((v) => {
  try {
    return new URL(v).origin === v.replace(/\/$/, "");
  } catch {
    return false;
  }
}, "must be an origin (scheme and host, no path)");

/** Neon's pooled address (host ends `-pooler`). pg-boss and Better Auth's migration need a direct connection. */
export const isPooledUrl = (url: string): boolean => /-pooler\./.test(url);

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: postgresUrl,
  BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters (openssl rand -base64 32)"),
  /** This API's own address. */
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  /** The web app's address: a trusted origin, and where emails link to. */
  APP_URL: origin.default("http://localhost:5173"),
  /** The marketing site's address, if it calls the API (a trusted origin). */
  SITE_URL: origin.optional(),
  TRUSTED_ORIGINS: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_", "must be a Stripe secret key (sk_…)").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_", "must be a Stripe webhook signing secret (whsec_…)").optional(),
  TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  MASTER_KEY_CURRENT: z.string().regex(/^\d+$/, "must be a key version number, e.g. 1").default("1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

export type Config = {
  nodeEnv: "development" | "test" | "production";
  databaseUrl: string;
  enabledModules: ModuleId[];
  authSecret: string;
  /** This API's own address. Also a trusted origin. */
  authUrl: string;
  /** The web app's address: sign-in redirects and email links point there. */
  appUrl: string;
  /** Browser origins that may call the API with cookies: the app, the site and TRUSTED_ORIGINS. */
  trustedOrigins: string[];
  /** People who are app admins the moment they sign up (or sign in), by email, lowercase. */
  adminEmails: string[];
  /** Google sign-in, on when both values are set. */
  google: { clientId: string; clientSecret: string } | null;
  /** Stripe, on when the secret key is set. The webhook secret is needed to receive webhooks. */
  stripe: { secretKey: string; webhookSecret: string | null } | null;
  /** Cloudflare Turnstile for the chat widget, on when both keys are set. */
  turnstile: { siteKey: string; secretKey: string } | null;
  masterKeyCurrent: string;
  /** Master keys by version, from MASTER_KEY_V<n>. Each is checked to be 32 bytes. */
  masterKeys: Record<string, string>;
  port: number;
};

/** Thrown when the environment is wrong. The message lists every problem, one per line. */
export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid configuration:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  }
}

/** A blank line in a .env file (`GOOGLE_CLIENT_ID=`) means "not set", not "set to an empty string". */
const withoutBlanks = (env: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v.trim() !== "")) as Record<string, string>;

export function loadConfig(rawEnv: Record<string, string | undefined> = process.env): Config {
  const env = withoutBlanks(rawEnv);
  const parsed = Env.safeParse(env);
  // Every check below runs even when the basic parse fails, so one boot reports every problem.
  const problems: string[] = parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join(".") || "env"}: ${i.message}`);

  const enabled = configuredModules();
  if (appConfig.modules.knowledge && !appConfig.modules.ai) problems.push("app.config.ts: modules.knowledge needs modules.ai");

  const masterKeys: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    const mk = /^MASTER_KEY_V(\d+)$/.exec(k);
    if (mk) {
      const check = base64Key.safeParse(v);
      if (!check.success) problems.push(`${k}: ${check.error.issues[0]!.message}`);
      masterKeys[mk[1]!] = v;
    }
  }
  const currentKey = env.MASTER_KEY_CURRENT ?? "1";
  if (!masterKeys[currentKey]) problems.push(`MASTER_KEY_V${currentKey}: missing (MASTER_KEY_CURRENT=${currentKey} points at it)`);

  const extraOrigins = csv(env.TRUSTED_ORIGINS);
  for (const o of extraOrigins)
    if (!origin.safeParse(o).success) problems.push(`TRUSTED_ORIGINS: "${o}" must be an origin (scheme and host, no path)`);

  // Pairs: both or neither.
  if (!!env.GOOGLE_CLIENT_ID !== !!env.GOOGLE_CLIENT_SECRET) problems.push("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET go together");
  if (!!env.TURNSTILE_SITE_KEY !== !!env.TURNSTILE_SECRET_KEY) problems.push("TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY go together");
  if (env.STRIPE_WEBHOOK_SECRET && !env.STRIPE_SECRET_KEY) problems.push("STRIPE_WEBHOOK_SECRET needs STRIPE_SECRET_KEY");

  // Production rules: what a public deploy must have.
  if (env.NODE_ENV === "production") {
    if (env.DATABASE_URL && isPooledUrl(env.DATABASE_URL))
      problems.push("DATABASE_URL: this is Neon's pooled address; use the direct one (no -pooler in the host)");
    for (const [k, v] of [
      ["BETTER_AUTH_URL", env.BETTER_AUTH_URL],
      ["APP_URL", env.APP_URL],
      ["SITE_URL", env.SITE_URL],
    ] as const)
      if (v && !v.startsWith("https://")) problems.push(`${k}: must be https in production`);
    for (const o of extraOrigins) if (!o.startsWith("https://")) problems.push(`TRUSTED_ORIGINS: "${o}" must be https in production`);
  }

  if (problems.length || !parsed.success) throw new ConfigError(problems);
  const e = parsed.data;
  const trustedOrigins = [
    ...new Set([e.BETTER_AUTH_URL.replace(/\/$/, ""), e.APP_URL, ...(e.SITE_URL ? [e.SITE_URL] : []), ...extraOrigins]),
  ];

  return {
    nodeEnv: e.NODE_ENV,
    databaseUrl: e.DATABASE_URL,
    enabledModules: enabled,
    authSecret: e.BETTER_AUTH_SECRET,
    authUrl: e.BETTER_AUTH_URL.replace(/\/$/, ""),
    appUrl: e.APP_URL,
    trustedOrigins,
    adminEmails: csv(e.ADMIN_EMAILS).map((s) => s.toLowerCase()),
    google: e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET ? { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET } : null,
    stripe: e.STRIPE_SECRET_KEY ? { secretKey: e.STRIPE_SECRET_KEY, webhookSecret: e.STRIPE_WEBHOOK_SECRET ?? null } : null,
    turnstile: e.TURNSTILE_SITE_KEY && e.TURNSTILE_SECRET_KEY ? { siteKey: e.TURNSTILE_SITE_KEY, secretKey: e.TURNSTILE_SECRET_KEY } : null,
    masterKeyCurrent: e.MASTER_KEY_CURRENT,
    masterKeys,
    port: e.PORT,
  };
}

/**
 * What the migration step needs: the database, and Better Auth's settings for its own migration. Not the master keys
 * or provider secrets, so migrations can run as a release step with fewer secrets.
 */
export function loadMigrationConfig(
  env: Record<string, string | undefined> = process.env,
): Pick<Config, "databaseUrl" | "authSecret" | "authUrl" | "appUrl" | "trustedOrigins" | "google" | "enabledModules"> {
  const parsed = Env.pick({
    DATABASE_URL: true,
    BETTER_AUTH_SECRET: true,
    BETTER_AUTH_URL: true,
    APP_URL: true,
    TRUSTED_ORIGINS: true,
  }).safeParse(withoutBlanks(env));
  if (!parsed.success) throw new ConfigError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  const e = parsed.data;
  return {
    databaseUrl: e.DATABASE_URL,
    authSecret: e.BETTER_AUTH_SECRET,
    authUrl: e.BETTER_AUTH_URL.replace(/\/$/, ""),
    appUrl: e.APP_URL,
    trustedOrigins: [e.BETTER_AUTH_URL.replace(/\/$/, ""), e.APP_URL, ...csv(e.TRUSTED_ORIGINS)],
    google: null,
    enabledModules: configuredModules(),
  };
}

import { z } from "zod";

// The one place that reads the environment. Everything else gets a typed Config.
// Loading fails fast, listing every problem at once, so a bad deploy stops at boot instead of on the first request.

export type ModuleId =
  | "identity"
  | "organizations"
  | "access"
  | "features"
  | "settings"
  | "billing"
  | "integrations"
  | "automation"
  | "seo";
export const allModules: ModuleId[] = [
  "identity",
  "organizations",
  "access",
  "features",
  "settings",
  "billing",
  "integrations",
  "automation",
  "seo",
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

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: postgresUrl,
  ENABLED_MODULES: z.string().optional(),
  PROVIDERS: z.enum(["stub", "live"]).default("stub"),
  PROVIDERS_LIVE: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters (openssl rand -base64 32)"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  TRUSTED_ORIGINS: z.string().optional(),
  PLATFORM_ADMIN_TOKEN: z.string().min(32, "must be at least 32 characters").optional(),
  MASTER_KEY_CURRENT: z.string().regex(/^\d+$/, "must be a key version number, e.g. 1").default("1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_", "must be a Stripe secret key (sk_…)").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_", "must be a Stripe webhook secret (whsec_…)").optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
});

export type Config = {
  nodeEnv: "development" | "test" | "production";
  databaseUrl: string;
  enabledModules: ModuleId[];
  providerDefault: "stub" | "live";
  providersLive: Set<string>;
  authSecret: string;
  /** This backend's own address. Also a trusted origin. */
  authUrl: string;
  /** Origins allowed to make changing requests (the frontend). Required in production. */
  trustedOrigins: string[];
  /** Protects /api/v1/admin. Unset = admin routes refuse everything. */
  platformAdminToken?: string;
  masterKeyCurrent: string;
  /** Master keys by version, from MASTER_KEY_V<n>. Each is checked to be 32 bytes. */
  masterKeys: Record<string, string>;
  port: number;
  stripe: { secretKey?: string; webhookSecret?: string };
  google: { clientId?: string; clientSecret?: string };
  /** Signing secrets for provider webhooks, from WEBHOOK_SECRET_<PROVIDER>, keyed by lowercase provider id. */
  webhookSecrets: Record<string, string>;
};

/** Thrown when the environment is wrong. The message lists every problem, one per line. */
export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid configuration:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  }
}

/** A blank line in a .env file (`STRIPE_SECRET_KEY=`) means "not set", not "set to an empty string". */
const withoutBlanks = (env: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v.trim() !== "")) as Record<string, string>;

export function loadConfig(rawEnv: Record<string, string | undefined> = process.env): Config {
  const env = withoutBlanks(rawEnv);
  const parsed = Env.safeParse(env);
  // Every check below runs even when the basic parse fails, so one boot reports every problem.
  const problems: string[] = parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join(".") || "env"}: ${i.message}`);

  const enabled = env.ENABLED_MODULES ? (csv(env.ENABLED_MODULES) as ModuleId[]) : allModules;
  const unknownModules = enabled.filter((m) => !allModules.includes(m));
  if (unknownModules.length) problems.push(`ENABLED_MODULES: unknown module(s) ${unknownModules.join(", ")}`);

  const masterKeys: Record<string, string> = {};
  const webhookSecrets: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    const mk = /^MASTER_KEY_V(\d+)$/.exec(k);
    if (mk) {
      const check = base64Key.safeParse(v);
      if (!check.success) problems.push(`${k}: ${check.error.issues[0]!.message}`);
      masterKeys[mk[1]!] = v;
    }
    const wh = /^WEBHOOK_SECRET_([A-Z0-9_]+)$/.exec(k);
    if (wh) {
      if (v.length < 16) problems.push(`${k}: must be at least 16 characters`);
      webhookSecrets[wh[1]!.toLowerCase()] = v;
    }
  }
  const currentKey = env.MASTER_KEY_CURRENT ?? "1";
  if (!masterKeys[currentKey]) problems.push(`MASTER_KEY_V${currentKey}: missing (MASTER_KEY_CURRENT=${currentKey} points at it)`);

  const trustedOrigins = csv(env.TRUSTED_ORIGINS);
  for (const o of trustedOrigins) {
    try {
      if (new URL(o).origin !== o.replace(/\/$/, "")) problems.push(`TRUSTED_ORIGINS: "${o}" must be an origin (scheme and host, no path)`);
    } catch {
      problems.push(`TRUSTED_ORIGINS: "${o}" is not a URL`);
    }
  }

  if (!!env.GOOGLE_CLIENT_ID !== !!env.GOOGLE_CLIENT_SECRET)
    problems.push("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET: set both or neither");

  // Production rules: what a public deploy must have.
  if (env.NODE_ENV === "production") {
    if (!(env.BETTER_AUTH_URL ?? "").startsWith("https://")) problems.push("BETTER_AUTH_URL: must be https in production");
    if (trustedOrigins.length === 0) problems.push("TRUSTED_ORIGINS: required in production (the frontend's origin)");
    for (const o of trustedOrigins) if (!o.startsWith("https://")) problems.push(`TRUSTED_ORIGINS: "${o}" must be https in production`);
  }

  if (problems.length || !parsed.success) throw new ConfigError(problems);
  const e = parsed.data;

  return {
    nodeEnv: e.NODE_ENV,
    databaseUrl: e.DATABASE_URL,
    enabledModules: enabled,
    providerDefault: e.PROVIDERS,
    providersLive: new Set(csv(e.PROVIDERS_LIVE)),
    authSecret: e.BETTER_AUTH_SECRET,
    authUrl: e.BETTER_AUTH_URL,
    trustedOrigins,
    platformAdminToken: e.PLATFORM_ADMIN_TOKEN,
    masterKeyCurrent: e.MASTER_KEY_CURRENT,
    masterKeys,
    port: e.PORT,
    stripe: { secretKey: e.STRIPE_SECRET_KEY, webhookSecret: e.STRIPE_WEBHOOK_SECRET },
    google: { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET },
    webhookSecrets,
  };
}

/** Whether a provider runs live or as a stub (ADR 0013). Stripe is always live. */
export function providerMode(cfg: Pick<Config, "providerDefault" | "providersLive">, provider: string): "live" | "stub" {
  if (provider === "stripe") return "live";
  if (cfg.providersLive.has(provider)) return "live";
  return cfg.providerDefault;
}

/**
 * What the migration step needs: the database, and Better Auth's settings for its own migration. Not the master keys
 * or provider secrets, so migrations can run as a release step with fewer secrets.
 */
export function loadMigrationConfig(
  env: Record<string, string | undefined> = process.env,
): Pick<Config, "databaseUrl" | "authSecret" | "authUrl" | "trustedOrigins"> {
  const parsed = Env.pick({ DATABASE_URL: true, BETTER_AUTH_SECRET: true, BETTER_AUTH_URL: true, TRUSTED_ORIGINS: true }).safeParse(
    withoutBlanks(env),
  );
  if (!parsed.success) throw new ConfigError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  const e = parsed.data;
  return {
    databaseUrl: e.DATABASE_URL,
    authSecret: e.BETTER_AUTH_SECRET,
    authUrl: e.BETTER_AUTH_URL,
    trustedOrigins: csv(e.TRUSTED_ORIGINS),
  };
}

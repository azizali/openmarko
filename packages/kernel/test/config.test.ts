import { describe, expect, test } from "bun:test";
import { allModules, ConfigError, coreModules, loadConfig, loadMigrationConfig, resolveModules, type ModuleDefinition } from "../src";

const key = Buffer.alloc(32, 1).toString("base64");
const base = { DATABASE_URL: "postgres://x", BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef", MASTER_KEY_V1: key };

const problemsOf = (env: Record<string, string | undefined>) => {
  try {
    loadConfig(env);
    return [];
  } catch (e) {
    if (e instanceof ConfigError) return e.problems;
    throw e;
  }
};

describe("config", () => {
  test("enables the core modules plus what app.config.ts turns on", () => {
    const cfg = loadConfig(base);
    for (const m of coreModules) expect(cfg.enabledModules).toContain(m);
    for (const m of cfg.enabledModules) expect(allModules).toContain(m);
  });

  test("lists every problem at once, basic and production rules together, so a bad deploy is fixed in one go", () => {
    const problems = problemsOf({
      NODE_ENV: "production",
      DATABASE_URL: "mysql://x",
      BETTER_AUTH_SECRET: "short",
      BETTER_AUTH_URL: "http://api.example.com",
      APP_URL: "https://app.example.com",
    });
    expect(problems.some((p) => p.startsWith("DATABASE_URL"))).toBe(true);
    expect(problems.some((p) => p.startsWith("BETTER_AUTH_SECRET"))).toBe(true);
    expect(problems).toContain("MASTER_KEY_V1: missing (MASTER_KEY_CURRENT=1 points at it)");
    expect(problems).toContain("BETTER_AUTH_URL: must be https in production");
  });

  test("the current master key must exist and be 32 bytes", () => {
    expect(problemsOf({ ...base, MASTER_KEY_V1: undefined })).toContain("MASTER_KEY_V1: missing (MASTER_KEY_CURRENT=1 points at it)");
    expect(problemsOf({ ...base, MASTER_KEY_V1: "dG9vc2hvcnQ=" })[0]).toContain("32 random bytes");
  });

  test("trusted origins are the API, the app, the site and TRUSTED_ORIGINS, each a bare origin", () => {
    expect(problemsOf({ ...base, TRUSTED_ORIGINS: "https://app.example.com/path" })[0]).toContain("must be an origin");
    const cfg = loadConfig({ ...base, SITE_URL: "https://www.example.com", TRUSTED_ORIGINS: "https://brand.example.com" });
    expect(cfg.trustedOrigins).toEqual([
      "http://localhost:3000",
      "http://localhost:5173",
      "https://www.example.com",
      "https://brand.example.com",
    ]);
  });

  test("services turn themselves on from their environment variables, in pairs", () => {
    expect(loadConfig(base).google).toBeNull();
    expect(loadConfig(base).stripe).toBeNull();
    expect(loadConfig({ ...base, GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" }).google).toEqual({
      clientId: "id",
      clientSecret: "s",
    });
    expect(problemsOf({ ...base, GOOGLE_CLIENT_ID: "id" })).toEqual(["GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET go together"]);
    expect(loadConfig({ ...base, STRIPE_SECRET_KEY: "sk_test_1" }).stripe).toEqual({ secretKey: "sk_test_1", webhookSecret: null });
    expect(problemsOf({ ...base, STRIPE_SECRET_KEY: "pk_test_1" })[0]).toContain("Stripe secret key");
    expect(problemsOf({ ...base, STRIPE_WEBHOOK_SECRET: "whsec_1" })).toEqual(["STRIPE_WEBHOOK_SECRET needs STRIPE_SECRET_KEY"]);
  });

  test("admin emails are lowercased", () => {
    expect(loadConfig({ ...base, ADMIN_EMAILS: "Me@Example.com, you@example.com" }).adminEmails).toEqual([
      "me@example.com",
      "you@example.com",
    ]);
  });

  test("production refuses Neon's pooled address", () => {
    const prod = { ...base, NODE_ENV: "production", BETTER_AUTH_URL: "https://api.example.com", APP_URL: "https://app.example.com" };
    const pooled = "postgres://u:p@ep-cool-1234-pooler.us-east-2.aws.neon.tech/app";
    expect(problemsOf({ ...prod, DATABASE_URL: pooled })[0]).toContain("pooled");
    expect(problemsOf({ ...base, DATABASE_URL: pooled })).toEqual([]); // only production
    expect(() => loadConfig({ ...prod, DATABASE_URL: pooled.replace("-pooler", "") })).not.toThrow();
  });

  test("production needs https everywhere", () => {
    const prod = { ...base, NODE_ENV: "production", BETTER_AUTH_URL: "https://api.example.com", APP_URL: "https://app.example.com" };
    expect(problemsOf(prod)).toEqual([]);
    expect(problemsOf({ ...prod, TRUSTED_ORIGINS: "http://other.example.com" })).toEqual([
      'TRUSTED_ORIGINS: "http://other.example.com" must be https in production',
    ]);
    expect(problemsOf({ ...prod, APP_URL: "http://app.example.com" })).toEqual(["APP_URL: must be https in production"]);
  });

  test("blank values from a copied .env.example count as unset, not as invalid", () => {
    const cfg = loadConfig({ ...base, STRIPE_SECRET_KEY: "", GOOGLE_CLIENT_ID: "", TRUSTED_ORIGINS: "" });
    expect(cfg.stripe).toBeNull();
  });

  test("the .env.example template itself loads once its two secrets are filled in", async () => {
    const text = await Bun.file(new URL("../../../.env.example", import.meta.url)).text();
    const env: Record<string, string> = {};
    for (const line of text.split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m) env[m[1]!] = m[2]!;
    }
    env.BETTER_AUTH_SECRET = "0123456789abcdef0123456789abcdef";
    env.MASTER_KEY_V1 = key;
    expect(() => loadConfig(env)).not.toThrow();
  });

  test("migrations need only the database and auth settings, not the master keys", () => {
    const m = loadMigrationConfig({ DATABASE_URL: "postgres://x", BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef" });
    expect(m.databaseUrl).toBe("postgres://x");
  });
});

const mod = (id: string, dependsOn?: string[]): ModuleDefinition => ({
  id,
  apiGroup: { name: id, description: id },
  dependsOn,
  setup: () => ({}),
});

describe("module loading", () => {
  test("orders dependencies first", () => {
    const out = resolveModules([mod("ai", ["organizations"]), mod("organizations", ["identity"]), mod("identity")]);
    expect(out.map((m) => m.id)).toEqual(["identity", "organizations", "ai"]);
  });

  test("fails when a dependency isn't enabled", () => {
    expect(() => resolveModules([mod("ai", ["organizations"])])).toThrow('depends on "organizations"');
  });

  test("fails on a dependency cycle", () => {
    expect(() => resolveModules([mod("a", ["b"]), mod("b", ["a"])])).toThrow("cycle");
  });
});

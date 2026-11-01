import { describe, expect, test } from "bun:test";
import { ConfigError, loadConfig, loadMigrationConfig, providerMode, resolveModules, type ModuleDefinition } from "../src";

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
  test("loads every module by default and parses the live list", () => {
    const cfg = loadConfig({ ...base, PROVIDERS_LIVE: "dataforseo, anthropic" });
    expect(cfg.enabledModules).toContain("seo");
    expect(cfg.enabledModules.length).toBe(9);
    expect(cfg.providersLive.has("dataforseo")).toBe(true);
  });

  test("rejects an unknown module name", () => {
    expect(problemsOf({ ...base, ENABLED_MODULES: "identity,nope" })).toEqual(["ENABLED_MODULES: unknown module(s) nope"]);
  });

  test("lists every problem at once, basic and production rules together, so a bad deploy is fixed in one go", () => {
    const problems = problemsOf({
      NODE_ENV: "production",
      DATABASE_URL: "mysql://x",
      BETTER_AUTH_SECRET: "short",
      BETTER_AUTH_URL: "http://api.example.com",
    });
    expect(problems.some((p) => p.startsWith("DATABASE_URL"))).toBe(true);
    expect(problems.some((p) => p.startsWith("BETTER_AUTH_SECRET"))).toBe(true);
    expect(problems).toContain("MASTER_KEY_V1: missing (MASTER_KEY_CURRENT=1 points at it)");
    expect(problems).toContain("BETTER_AUTH_URL: must be https in production");
    expect(problems).toContain("TRUSTED_ORIGINS: required in production (the frontend's origin)");
  });

  test("the current master key must exist and be 32 bytes", () => {
    expect(problemsOf({ ...base, MASTER_KEY_V1: undefined })).toContain("MASTER_KEY_V1: missing (MASTER_KEY_CURRENT=1 points at it)");
    expect(problemsOf({ ...base, MASTER_KEY_V1: "dG9vc2hvcnQ=" })[0]).toContain("32 random bytes");
  });

  test("trusted origins must be bare origins", () => {
    expect(problemsOf({ ...base, TRUSTED_ORIGINS: "https://app.example.com/path" })[0]).toContain("must be an origin");
    expect(loadConfig({ ...base, TRUSTED_ORIGINS: "https://app.example.com, https://brand.example.com" }).trustedOrigins).toEqual([
      "https://app.example.com",
      "https://brand.example.com",
    ]);
  });

  test("Google OAuth needs both client id and secret, or neither", () => {
    expect(problemsOf({ ...base, GOOGLE_CLIENT_ID: "id" })).toEqual(["GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET: set both or neither"]);
  });

  test("Stripe keys and webhook secrets are checked by shape", () => {
    expect(problemsOf({ ...base, STRIPE_SECRET_KEY: "pk_live_x" })[0]).toContain("sk_");
    expect(problemsOf({ ...base, WEBHOOK_SECRET_DATAFORSEO: "short" })[0]).toContain("at least 16");
    expect(loadConfig({ ...base, WEBHOOK_SECRET_DATAFORSEO: "0123456789abcdef" }).webhookSecrets).toEqual({
      dataforseo: "0123456789abcdef",
    });
  });

  test("production needs https and the frontend's origin", () => {
    const problems = problemsOf({ ...base, NODE_ENV: "production", BETTER_AUTH_URL: "http://api.example.com" });
    expect(problems).toContain("BETTER_AUTH_URL: must be https in production");
    expect(problems).toContain("TRUSTED_ORIGINS: required in production (the frontend's origin)");
    expect(
      problemsOf({
        ...base,
        NODE_ENV: "production",
        BETTER_AUTH_URL: "https://api.example.com",
        TRUSTED_ORIGINS: "https://app.example.com",
      }),
    ).toEqual([]);
  });

  test("blank values from a copied .env.example count as unset, not as invalid", () => {
    const cfg = loadConfig({
      ...base,
      STRIPE_SECRET_KEY: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      PLATFORM_ADMIN_TOKEN: "",
      TRUSTED_ORIGINS: "",
    });
    expect(cfg.stripe.secretKey).toBeUndefined();
    expect(cfg.platformAdminToken).toBeUndefined();
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

  test("provider mode: stub by default, live per provider, Stripe always live (ADR 0013)", () => {
    const cfg = loadConfig({ ...base, PROVIDERS: "stub", PROVIDERS_LIVE: "dataforseo" });
    expect(providerMode(cfg, "dataforseo")).toBe("live");
    expect(providerMode(cfg, "anthropic")).toBe("stub");
    expect(providerMode(cfg, "stripe")).toBe("live");
  });
});

const mod = (id: string, dependsOn?: string[]): ModuleDefinition => ({ id, dependsOn, setup: () => ({}) });

describe("module loading", () => {
  test("orders dependencies first", () => {
    const out = resolveModules([mod("seo", ["organizations"]), mod("organizations", ["identity"]), mod("identity")]);
    expect(out.map((m) => m.id)).toEqual(["identity", "organizations", "seo"]);
  });

  test("fails when a dependency isn't enabled", () => {
    expect(() => resolveModules([mod("seo", ["organizations"])])).toThrow('depends on "organizations"');
  });

  test("fails on a dependency cycle", () => {
    expect(() => resolveModules([mod("a", ["b"]), mod("b", ["a"])])).toThrow("cycle");
  });
});

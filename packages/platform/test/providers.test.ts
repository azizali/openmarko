import { describe, expect, test } from "bun:test";
import { ConfigError, loadConfig } from "@openmarko/kernel";
import { checkProviders } from "../src";

const base = {
  DATABASE_URL: "postgres://x",
  BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef",
  MASTER_KEY_V1: Buffer.alloc(32, 1).toString("base64"),
};

describe("deploy-time provider checks", () => {
  test("an unknown name in PROVIDERS_LIVE stops the boot", () => {
    expect(() => checkProviders(loadConfig({ ...base, PROVIDERS_LIVE: "dataforsoe" }))).toThrow(ConfigError);
  });

  test("Google Business Profile live needs the Google OAuth client", () => {
    expect(() => checkProviders(loadConfig({ ...base, PROVIDERS_LIVE: "gbp" }))).toThrow("GOOGLE_CLIENT_ID");
    expect(() =>
      checkProviders(loadConfig({ ...base, PROVIDERS_LIVE: "gbp", GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" })),
    ).not.toThrow();
  });

  test("all-stub config passes", () => {
    expect(() => checkProviders(loadConfig(base))).not.toThrow();
  });
});

import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { verifyProviderWebhook } from "../src/webhooks";

const env = { dataforseo: "whsec-dfs" };
const sign = (body: string) => createHmac("sha256", "whsec-dfs").update(body).digest("hex");

describe("provider webhooks fail closed", () => {
  test("refused when no secret is configured for the provider", () => {
    expect(() => verifyProviderWebhook("gbp", "{}", "abc", env)).toThrow("aren't configured");
  });
  test("refused without a signature", () => {
    expect(() => verifyProviderWebhook("dataforseo", "{}", null, env)).toThrow("Missing signature");
  });
  test("refused when the signature doesn't match the body", () => {
    expect(() => verifyProviderWebhook("dataforseo", '{"id":"1"}', sign('{"id":"2"}'), env)).toThrow("doesn't match");
  });
  test("accepted when the signature matches", () => {
    expect(() => verifyProviderWebhook("dataforseo", '{"id":"1"}', sign('{"id":"1"}'), env)).not.toThrow();
  });
});

import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { verifyProviderWebhook } from "../src/webhooks";

const secret = "whsec-slack";
const sign = (body: string) => createHmac("sha256", secret).update(body).digest("hex");

describe("provider webhooks fail closed", () => {
  test("refused when no secret is configured for the provider", () => {
    expect(() => verifyProviderWebhook("slack", "{}", "abc", undefined)).toThrow("aren't configured");
  });
  test("refused without a signature", () => {
    expect(() => verifyProviderWebhook("slack", "{}", null, secret)).toThrow("Missing signature");
  });
  test("refused when the signature doesn't match the body", () => {
    expect(() => verifyProviderWebhook("slack", '{"id":"1"}', sign('{"id":"2"}'), secret)).toThrow("doesn't match");
  });
  test("accepted when the signature matches", () => {
    expect(() => verifyProviderWebhook("slack", '{"id":"1"}', sign('{"id":"1"}'), secret)).not.toThrow();
  });
});

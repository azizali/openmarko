import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { mapStripeStatus, verifyStripeSignature } from "../src/providers";

const secret = "whsec_test_123";
const sign = (body: string, t: number) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;

describe("Stripe webhook signature (ADR 0012, Stripe's scheme)", () => {
  test("accepts a correctly signed, fresh payload", () => {
    const now = 1_700_000_000;
    expect(() => verifyStripeSignature('{"id":"evt"}', sign('{"id":"evt"}', now), secret, { now })).not.toThrow();
  });

  test("rejects a payload that was changed after signing", () => {
    const now = 1_700_000_000;
    expect(() => verifyStripeSignature('{"id":"other"}', sign('{"id":"evt"}', now), secret, { now })).toThrow("does not match");
  });

  test("rejects a signature older than the tolerance (replay)", () => {
    const old = 1_700_000_000;
    expect(() => verifyStripeSignature("{}", sign("{}", old), secret, { now: old + 3600 })).toThrow("too old");
  });

  test("rejects a missing or malformed header", () => {
    expect(() => verifyStripeSignature("{}", null, secret)).toThrow("Missing");
    expect(() => verifyStripeSignature("{}", "garbage", secret)).toThrow("Malformed");
  });

  test("maps Stripe statuses onto ours", () => {
    expect(mapStripeStatus("active")).toBe("active");
    expect(mapStripeStatus("past_due")).toBe("past_due");
    expect(mapStripeStatus("unpaid")).toBe("past_due");
    expect(mapStripeStatus("incomplete_expired")).toBe("incomplete");
  });
});

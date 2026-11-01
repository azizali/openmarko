import { describe, expect, test } from "bun:test";
import { statusOf } from "../src/status";
import type { Entitlements } from "@openmarko/billing";

// A Plan that allows the SEO module and its features. Missing a key means off (ADR 0012).
const allowAll = (...ids: string[]): Entitlements => new Map(ids.map((i) => [`feature.${i}`, 1]));

describe("is a feature on? (ADR 0006, ADR 0012)", () => {
  test("off when the Plan doesn't include it, even if the Organization switched it on", () => {
    const s = statusOf("rankings", { rankings: true }, allowAll("seo"));
    expect(s).toEqual({ on: false, why: "not in your plan" });
  });

  test("off when the Organization turned it off", () => {
    const s = statusOf("rankings", { rankings: false }, allowAll("seo", "rankings"));
    expect(s.on).toBe(false);
    expect(s.why).toBe("turned off");
  });

  test("off when its module is off", () => {
    const s = statusOf("rankings", { seo: false }, allowAll("seo", "rankings"));
    expect(s.on).toBe(false);
    expect(s.why).toBe("turned off");
  });

  test("on when the Plan, the switch and the module all agree", () => {
    expect(statusOf("rankings", {}, allowAll("seo", "rankings"))).toEqual({ on: true });
  });

  test("needsAny: inbox needs email or texting to be on", () => {
    expect(statusOf("inbox", {}, allowAll("customers", "inbox")).on).toBe(false);
    expect(statusOf("inbox", {}, allowAll("customers", "inbox", "email")).on).toBe(true);
  });
});

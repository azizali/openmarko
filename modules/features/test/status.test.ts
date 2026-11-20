import { describe, expect, test } from "bun:test";
import { unlimitedBilling, type Entitlements } from "@app/kernel";
import { setEnabledModules, statusOf } from "../src/status";

// A Plan that allows some features. Missing a key means off (ADR 0012).
const allow = (...ids: string[]): Entitlements => new Map(ids.map((i) => [`feature.${i}`, 1]));
const withPlan = { featureAllowed: (ent: Entitlements, f: string) => ent.get(`feature.${f}`) === 1 };

describe("is a feature on? (ADR 0006, ADR 0012)", () => {
  setEnabledModules(["ai", "knowledge"]);

  test("off when its module isn't in this app", () => {
    expect(statusOf("automation", {}, allow("automation"), withPlan)).toMatchObject({ on: false, why: "not in this app" });
  });

  test("off when the Plan doesn't include it, even if the Organization switched it on", () => {
    expect(statusOf("assistant", { assistant: true }, allow(), withPlan)).toMatchObject({ on: false, why: "not in your plan" });
  });

  test("off when the Organization turned it off", () => {
    expect(statusOf("assistant", { assistant: false }, allow("assistant"), withPlan)).toMatchObject({ on: false, why: "turned off" });
  });

  test("on when the module, the Plan and the switch all agree", () => {
    expect(statusOf("assistant", {}, allow("assistant"), withPlan)).toMatchObject({ on: true, label: "AI assistant" });
  });

  test("without the billing module, every feature is allowed by the Plan", () => {
    expect(statusOf("assistant", {}, new Map(), unlimitedBilling).on).toBe(true);
    expect(statusOf("assistant", {}, new Map()).on).toBe(true);
  });
});

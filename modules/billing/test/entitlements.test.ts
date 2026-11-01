import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createTestDb, ownerSession, type TestDb, type Session } from "@openmarko/testkit";
import { AppError } from "@openmarko/kernel";
import { assertMeterAllowed, assignPlanManually, checkLimit, entitlementsFor, recordUsage, setOverride, upsertPlan } from "../src";
import { authOrganization } from "@openmarko/kernel";
import { eq } from "drizzle-orm";

let t: TestDb;
let owner: Session;

beforeAll(async () => {
  t = await createTestDb();
  owner = await ownerSession(t.ctx);
  await upsertPlan(t.ctx, {
    id: "starter",
    name: "Starter",
    entitlements: { "feature.seo": 1, "feature.rankings": 1, "limit.locations": 2, "action.reviews.post": 0, "limit.keywords": null },
    meters: [
      { meter: "dataforseo.request", included: 10, overage: "charge", unitPriceMicros: 5000 },
      { meter: "llm.tokens", included: 5, overage: "block" },
      { meter: "email.sent", included: 0, overage: "byok_only" },
    ],
  });
  await assignPlanManually(t.ctx, owner.orgId, "starter");
});
afterAll(() => t.teardown());

describe("entitlements come from the Plan, then overrides (ADR 0012)", () => {
  test("a Plan's features, limits and removed actions apply to its Organization", async () => {
    const ent = await entitlementsFor(t.ctx, owner.orgId);
    expect(ent.get("feature.seo")).toBe(1);
    expect(ent.get("limit.locations")).toBe(2);
    expect(ent.get("action.reviews.post")).toBe(0);
    expect(ent.has("feature.sales")).toBe(false);
  });

  test("an override wins over the Plan, and an expired one stops applying", async () => {
    await setOverride(t.ctx, owner.orgId, "limit.locations", 5, "support: extra location");
    expect((await entitlementsFor(t.ctx, owner.orgId)).get("limit.locations")).toBe(5);
    await setOverride(t.ctx, owner.orgId, "limit.locations", 9, "expired", { expiresAt: new Date(Date.now() - 1000) });
    expect((await entitlementsFor(t.ctx, owner.orgId)).get("limit.locations")).toBe(2);
  });

  test("a limit stops at its number and never hides what exists", async () => {
    const ent = await entitlementsFor(t.ctx, owner.orgId);
    checkLimit(ent, "locations", 1);
    expect(() => checkLimit(ent, "locations", 2)).toThrow(AppError);
    checkLimit(ent, "keywords", 10_000);
  });

  test("a Partner's Plan covers its Clients when the Client has none of its own", async () => {
    const partner = await ownerSession(t.ctx, { orgName: "Brightline Local" });
    const client = await ownerSession(t.ctx, { orgName: "Hill Country Plumbing" });
    await upsertPlan(t.ctx, { id: "agency", name: "Agency", entitlements: { partner: 1, "feature.seo": 1 } });
    await assignPlanManually(t.ctx, partner.orgId, "agency");
    await t.ctx.db.update(authOrganization).set({ partnerId: partner.orgId }).where(eq(authOrganization.id, client.orgId));
    expect((await entitlementsFor(t.ctx, client.orgId)).get("feature.seo")).toBe(1);
  });
});

describe("metered use: blocked, charged or byok-only (ADR 0012)", () => {
  test("within the included units, nothing is charged", async () => {
    const r = await assertMeterAllowed(t.ctx, owner.orgId, "dataforseo.request", 4, { byok: false });
    expect(r).toEqual({ overageUnits: 0, overagePriceMicros: 0 });
  });

  test("beyond the included units, a 'charge' meter prices the overage", async () => {
    await recordUsage(t.ctx.db, {
      organizationId: owner.orgId,
      meter: "dataforseo.request",
      quantity: 10,
      costMicros: 6000,
      provider: "dataforseo",
      mode: "stub",
    });
    const r = await assertMeterAllowed(t.ctx, owner.orgId, "dataforseo.request", 3, { byok: false });
    expect(r).toEqual({ overageUnits: 3, overagePriceMicros: 15000 });
  });

  test("a 'block' meter refuses the call once the allowance is used", async () => {
    await recordUsage(t.ctx.db, {
      organizationId: owner.orgId,
      meter: "llm.tokens",
      quantity: 5,
      costMicros: 10,
      provider: "anthropic",
      mode: "stub",
    });
    await expect(assertMeterAllowed(t.ctx, owner.orgId, "llm.tokens", 1, { byok: false })).rejects.toMatchObject({ status: 402 });
  });

  test("a meter the Plan doesn't sell is blocked, unless the Organization brings its own key", async () => {
    await expect(assertMeterAllowed(t.ctx, owner.orgId, "sms.sent", 1, { byok: false })).rejects.toBeInstanceOf(AppError);
    expect((await assertMeterAllowed(t.ctx, owner.orgId, "sms.sent", 1, { byok: true })).overageUnits).toBe(0);
  });

  test("'byok_only' meters are allowed only with the Organization's own key", async () => {
    await expect(assertMeterAllowed(t.ctx, owner.orgId, "email.sent", 1, { byok: false })).rejects.toBeInstanceOf(AppError);
    await assertMeterAllowed(t.ctx, owner.orgId, "email.sent", 1, { byok: true });
  });
});

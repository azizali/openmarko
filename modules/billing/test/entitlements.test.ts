import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createTestDb, ownerSession, type TestDb, type Session } from "@app/testkit";
import { AppError } from "@app/kernel";
import { assertMeterAllowed, assignPlanManually, checkLimit, entitlementsFor, recordUsage, setOverride, upsertPlan } from "../src";
import { authOrganization } from "@app/kernel";
import { eq } from "drizzle-orm";

let t: TestDb;
let owner: Session;

beforeAll(async () => {
  t = await createTestDb();
  owner = await ownerSession(t.ctx);
  await upsertPlan(t.ctx, {
    id: "starter",
    name: "Starter",
    entitlements: { "feature.assistant": 1, "feature.knowledge": 1, "limit.seats": 2, "action.ai.configure": 0, "limit.bases": null },
    meters: [
      { meter: "email.sent", included: 10, overage: "charge", unitPriceMicros: 5000 },
      { meter: "llm.tokens", included: 5, overage: "block" },
      { meter: "sms.sent", included: 0, overage: "byok_only" },
    ],
  });
  await assignPlanManually(t.ctx, owner.orgId, "starter");
});
afterAll(() => t.teardown());

describe("entitlements come from the Plan, then overrides (ADR 0012)", () => {
  test("a Plan's features, limits and removed actions apply to its Organization", async () => {
    const ent = await entitlementsFor(t.ctx, owner.orgId);
    expect(ent.get("feature.assistant")).toBe(1);
    expect(ent.get("limit.seats")).toBe(2);
    expect(ent.get("action.ai.configure")).toBe(0);
    expect(ent.has("feature.automation")).toBe(false);
  });

  test("an override wins over the Plan, and an expired one stops applying", async () => {
    await setOverride(t.ctx, owner.orgId, "limit.seats", 5, "support: extra seats");
    expect((await entitlementsFor(t.ctx, owner.orgId)).get("limit.seats")).toBe(5);
    await setOverride(t.ctx, owner.orgId, "limit.seats", 9, "expired", { expiresAt: new Date(Date.now() - 1000) });
    expect((await entitlementsFor(t.ctx, owner.orgId)).get("limit.seats")).toBe(2);
  });

  test("a limit stops at its number and never hides what exists", async () => {
    const ent = await entitlementsFor(t.ctx, owner.orgId);
    checkLimit(ent, "seats", 1);
    expect(() => checkLimit(ent, "seats", 2)).toThrow(AppError);
    checkLimit(ent, "bases", 10_000);
  });

  test("a Partner's Plan covers its Clients when the Client has none of its own", async () => {
    const partner = await ownerSession(t.ctx, { orgName: "Brightline" });
    const client = await ownerSession(t.ctx, { orgName: "Hill Country Plumbing" });
    await upsertPlan(t.ctx, { id: "partner", name: "Partner", entitlements: { partner: 1, "feature.assistant": 1 } });
    await assignPlanManually(t.ctx, partner.orgId, "partner");
    await t.ctx.db.update(authOrganization).set({ partnerId: partner.orgId }).where(eq(authOrganization.id, client.orgId));
    expect((await entitlementsFor(t.ctx, client.orgId)).get("feature.assistant")).toBe(1);
  });
});

describe("metered use: blocked, charged or byok-only (ADR 0012)", () => {
  test("within the included units, nothing is charged", async () => {
    expect(await assertMeterAllowed(t.ctx, owner.orgId, "email.sent", 4, { byok: false })).toEqual({
      overageUnits: 0,
      overagePriceMicros: 0,
    });
  });

  test("beyond the included units, a 'charge' meter prices the overage", async () => {
    await recordUsage(t.ctx.db, {
      organizationId: owner.orgId,
      meter: "email.sent",
      quantity: 10,
      costMicros: 6000,
      provider: "resend",
      mode: "stub",
    });
    expect(await assertMeterAllowed(t.ctx, owner.orgId, "email.sent", 3, { byok: false })).toEqual({
      overageUnits: 3,
      overagePriceMicros: 15000,
    });
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
    await expect(assertMeterAllowed(t.ctx, owner.orgId, "other.thing", 1, { byok: false })).rejects.toBeInstanceOf(AppError);
    expect((await assertMeterAllowed(t.ctx, owner.orgId, "other.thing", 1, { byok: true })).overageUnits).toBe(0);
  });

  test("'byok_only' meters are allowed only with the Organization's own key", async () => {
    await expect(assertMeterAllowed(t.ctx, owner.orgId, "sms.sent", 1, { byok: false })).rejects.toBeInstanceOf(AppError);
    await assertMeterAllowed(t.ctx, owner.orgId, "sms.sent", 1, { byok: true });
  });
});

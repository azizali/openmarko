// No "no Plan": an Organization with no Plan of its own (one just made at sign-up) is on the default Plan.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { adminSession, createTestDb, ownerSession, requester, type TestDb } from "@app/testkit";
import { assertMeterAllowed, assignPlanManually, entitlementsFor, listPlans, planIdFor, upsertPlan } from "../src";

let t: TestDb;
const plan = (id: string, extra: { default?: boolean } = {}) =>
  upsertPlan(t.ctx, {
    id,
    name: id,
    default: extra.default,
    entitlements: { [`feature.${id}`]: 1 },
    meters: [{ meter: "llm.tokens", included: 1000, overage: "block" }],
  });

beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.teardown());

describe("the default Plan", () => {
  test("without one, a new Organization has no Plan and metered use is refused", async () => {
    const { orgId } = await ownerSession(t.ctx, { orgName: "Before" });
    expect(await planIdFor(t.ctx, orgId)).toBeNull();
    await expect(assertMeterAllowed(t.ctx, orgId, "llm.tokens", 10, { byok: false })).rejects.toMatchObject({ status: 402 });
  });

  test("with one, every Organization without its own Plan is on it; one of its own wins", async () => {
    await plan("free", { default: true });
    await plan("pro");
    const { orgId } = await ownerSession(t.ctx, { orgName: "New" });
    expect(await planIdFor(t.ctx, orgId)).toBe("free");
    expect((await entitlementsFor(t.ctx, orgId)).get("feature.free")).toBe(1);
    expect(await assertMeterAllowed(t.ctx, orgId, "llm.tokens", 10, { byok: false })).toEqual({ overageUnits: 0, overagePriceMicros: 0 });
    await assignPlanManually(t.ctx, orgId, "pro");
    expect(await planIdFor(t.ctx, orgId)).toBe("pro");
  });

  test("making another Plan the default moves it; saving a Plan without saying keeps it", async () => {
    await plan("pro", { default: true });
    await plan("free");
    const { rows } = await t.ctx.pool.query(`select id from billing.plans where is_default`);
    expect(rows.map((r) => r.id)).toEqual(["pro"]);
    expect((await listPlans(t.ctx)).find((p) => p.id === "pro")).toMatchObject({ isDefault: true, organizations: 1 });
  });

  test("an admin saves Plans and puts an Organization on one through the API", async () => {
    const { compose, buildApi } = await import("@app/server");
    const call = requester(buildApi(t.ctx, compose(t.ctx)));
    const admin = await adminSession(t.ctx);
    const owner = await ownerSession(t.ctx, { orgName: "Via API" });
    expect(
      (await call("PUT", "/api/v1/admin/plans", { headers: owner.headers, body: { id: "x", name: "X", entitlements: {} } })).status,
    ).toBe(403);
    expect(
      (
        await call("PUT", "/api/v1/admin/plans", {
          headers: admin.headers,
          body: { id: "team", name: "Team", entitlements: { "feature.assistant": 1 } },
        })
      ).status,
    ).toBe(200);
    expect(
      (await call("POST", `/api/v1/admin/organizations/${owner.orgId}/plan`, { headers: admin.headers, body: { planId: "team" } })).status,
    ).toBe(200);
    const billing = await call("GET", `/api/v1/organizations/${owner.orgId}/billing`, { headers: owner.headers });
    expect(billing.body.planId).toBe("team");
    const features = await call("GET", `/api/v1/organizations/${owner.orgId}/features`, { headers: owner.headers });
    expect(features.body.assistant.on).toBe(true);
    expect(features.body.knowledge).toMatchObject({ on: false, why: "not in your plan" });
  });
});

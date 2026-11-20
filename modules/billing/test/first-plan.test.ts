// A new app has a Plan from its first deploy, and a deploy never rewrites Plans an admin has changed.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createTestDb, type TestDb } from "@app/testkit";
import { ensureFirstPlan, listPlans, upsertPlan } from "../src";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.teardown());

describe("ensureFirstPlan", () => {
  test("into an empty table: a default Plan", async () => {
    expect(await ensureFirstPlan(t.ctx)).toBe(true);
    const plans = await listPlans(t.ctx);
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ id: "free", isDefault: true });
  });

  test("once any Plan exists, it leaves them alone", async () => {
    await upsertPlan(t.ctx, { id: "free", name: "Renamed", entitlements: {} });
    expect(await ensureFirstPlan(t.ctx)).toBe(false);
    expect((await listPlans(t.ctx))[0]!.name).toBe("Renamed");
  });
});

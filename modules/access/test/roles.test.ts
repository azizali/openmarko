import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createTestDb, ownerSession, type TestDb, type Session } from "@openmarko/testkit";
import { addMember } from "@openmarko/organizations";
import { permissionFor, saveRole, deleteRole, toRoleSpec } from "../src";

let t: TestDb;
let owner: Session;

beforeAll(async () => {
  t = await createTestDb();
  owner = await ownerSession(t.ctx, { orgName: "Roles org" });
});
afterAll(() => t.teardown());

describe("custom Roles compile to permissions (ADR 0003)", () => {
  test("a front desk role gets exactly the actions it names, and no owner-only ones", async () => {
    await saveRole(
      t.ctx,
      owner.orgId,
      "Front desk",
      { name: "Front desk", base: "none", groups: {}, resources: { reviews: ["view", "reply"], customers: "edit" } },
      false,
    );
    const p = await permissionFor(t.ctx, owner.orgId, "Front desk");
    expect(p.reviews).toEqual(["view", "reply"]);
    expect(p.customers).toContain("edit");
    expect(p.customers).not.toContain("delete");
    expect(p.organization).toBeUndefined();
  });

  test("an action name that doesn't exist is refused, not ignored", () => {
    expect(() => toRoleSpec("x", { name: "x", base: "none", groups: {}, resources: { reviews: ["fly"] } })).toThrow("Unknown actions");
  });

  test("a built-in role name can't be reused", async () => {
    await expect(
      saveRole(t.ctx, owner.orgId, "owner", { name: "owner", base: "view", groups: {}, resources: {} }, false),
    ).rejects.toMatchObject({ status: 409 });
  });

  test("a role people still hold can't be deleted; one nobody holds can", async () => {
    await saveRole(t.ctx, owner.orgId, "Temp", { name: "Temp", base: "view", groups: {}, resources: {} }, false);
    const person = await ownerSession(t.ctx, { orgName: "Temp holder" });
    await addMember(t.ctx, owner.orgId, person.userId, "Temp");
    await expect(deleteRole(t.ctx, owner.orgId, "Temp")).rejects.toMatchObject({ status: 409 });
    await addMember(t.ctx, owner.orgId, person.userId, "viewer");
    await deleteRole(t.ctx, owner.orgId, "Temp");
  });
});

describe("a role recompiles from its spec when the access model changes", () => {
  test("a stored grant that's out of date is replaced by the grant its spec gives today", async () => {
    const { authOrganizationRole } = await import("@openmarko/kernel");
    const { eq, and } = await import("drizzle-orm");
    await saveRole(t.ctx, owner.orgId, "Stale", { name: "Stale", base: "view", groups: {}, resources: { reviews: ["view"] } }, false);
    await t.ctx.db
      .update(authOrganizationRole)
      .set({ permission: JSON.stringify({ reviews: [] }) })
      .where(and(eq(authOrganizationRole.organizationId, owner.orgId), eq(authOrganizationRole.role, "Stale")));
    const p = await permissionFor(t.ctx, owner.orgId, "Stale");
    expect(p.reviews).toEqual(["view"]);
  });
});

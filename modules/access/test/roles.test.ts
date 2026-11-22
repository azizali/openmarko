import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { authOf } from "@app/identity";
import type { AccessCatalog } from "@app/kernel";
import { createTestDb, ownerSession, type TestDb, type Session } from "@app/testkit";
import { addMember } from "@app/organizations";
import { accessFor, callerFor, permissionFor, saveRole, deleteRole, toRoleSpec } from "../src";

let t: TestDb;
let owner: Session;
let access: AccessCatalog;
const ids = (a: AccessCatalog) => a.resources.map((r) => r.id);

beforeAll(async () => {
  t = await createTestDb();
  owner = await ownerSession(t.ctx, { orgName: "Roles org" });
  access = accessFor(t.ctx);
});
afterAll(() => t.teardown());

describe("custom Roles compile to permissions (ADR 0003)", () => {
  test("a front desk role gets exactly the actions it names, and no owner-only ones", async () => {
    await saveRole(
      t.ctx,
      access,
      owner.orgId,
      "Front desk",
      { name: "Front desk", base: "none", groups: {}, resources: { ai: ["chat"], setup: "manage", billing: "manage" } },
      false,
    );
    const p = await permissionFor(t.ctx, access, owner.orgId, "Front desk");
    expect(p.ai).toEqual(["chat"]);
    expect(p.setup).toContain("connect");
    expect(p.billing).toEqual(["view"]);
    expect(p.organization).toBeUndefined();
  });

  test("an action name that doesn't exist is refused, not ignored", () => {
    expect(() => toRoleSpec(access, "x", { name: "x", base: "none", groups: {}, resources: { ai: ["fly"] } })).toThrow("Unknown actions");
    // An action that exists, but on another resource, is just as unknown here.
    expect(() => toRoleSpec(access, "x", { name: "x", base: "none", groups: {}, resources: { ai: ["connect"] } })).toThrow(
      "Unknown actions",
    );
    expect(() => toRoleSpec(access, "x", { name: "x", base: "none", groups: {}, resources: { reviews: ["view"] } })).toThrow(
      "Unknown resource reviews",
    );
    expect(() => toRoleSpec(access, "x", { name: "x", base: "none", groups: { crm: "view" }, resources: {} })).toThrow("Unknown group crm");
  });

  test("a built-in role name can't be reused", async () => {
    await expect(
      saveRole(t.ctx, access, owner.orgId, "owner", { name: "owner", base: "view", groups: {}, resources: {} }, false),
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  test("a role people still hold can't be deleted; one nobody holds can", async () => {
    await saveRole(t.ctx, access, owner.orgId, "Temp", { name: "Temp", base: "view", groups: {}, resources: {} }, false);
    const person = await ownerSession(t.ctx, { orgName: "Temp holder" });
    await addMember(t.ctx, owner.orgId, person.userId, "Temp");
    await expect(deleteRole(t.ctx, owner.orgId, "Temp")).rejects.toMatchObject({ status: 409 });
    await addMember(t.ctx, owner.orgId, person.userId, "viewer");
    await deleteRole(t.ctx, owner.orgId, "Temp");
  });
});

describe("a role recompiles from its spec when the access model changes", () => {
  test("a stored grant that's out of date is replaced by the grant its spec gives today", async () => {
    const { authOrganizationRole } = await import("@app/kernel");
    const { eq, and } = await import("drizzle-orm");
    await saveRole(t.ctx, access, owner.orgId, "Stale", { name: "Stale", base: "view", groups: {}, resources: { ai: ["chat"] } }, false);
    await t.ctx.db
      .update(authOrganizationRole)
      .set({ permission: JSON.stringify({ ai: [] }) })
      .where(and(eq(authOrganizationRole.organizationId, owner.orgId), eq(authOrganizationRole.role, "Stale")));
    const p = await permissionFor(t.ctx, access, owner.orgId, "Stale");
    expect(p.ai).toEqual(["chat"]);
  });
});

describe("Roles come from the enabled modules", () => {
  test("the catalog holds the core resources and the optional modules' ones", () => {
    expect(ids(access)).toEqual(
      expect.arrayContaining(["organization", "member", "ac", "setup", "ai", "knowledge", "billing", "activity"]),
    );
    expect(access.groups.map((g) => g.id)).toEqual(expect.arrayContaining(["organization", "ai", "automation"]));
  });

  test("knowledge bases sit in the AI group, not one of their own", () => {
    expect(access.groups.map((g) => g.id)).not.toContain("knowledge");
    expect(access.resources.find((r) => r.id === "knowledge")?.group).toBe("ai");
  });

  test("an Owner's permission covers everything, owner-only actions included", async () => {
    const caller = await callerFor(t.ctx, owner.headers, owner.orgId);
    expect(caller.role).toBe("owner");
    expect(caller.permission.organization).toContain("delete");
    expect(caller.permission.ai).toContain("configure");
  });

  test("Better Auth's own Role endpoint checks the same statement", async () => {
    const auth = authOf(t.ctx);
    await expect(
      auth.api.createOrgRole({
        body: { role: "reviewer", permission: { reviews: ["view"] }, organizationId: owner.orgId },
        headers: owner.headers,
      }),
    ).rejects.toMatchObject({ body: { code: "INVALID_RESOURCE" } });
    const made = await auth.api.createOrgRole({
      body: { role: "chatter", permission: { ai: ["chat"] }, organizationId: owner.orgId },
      headers: owner.headers,
    });
    expect(made.success).toBe(true);
  });
});

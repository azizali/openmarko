import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { adminSession, createTestDb, ownerSession, requester, type TestDb, type Session } from "@app/testkit";
import { buildApi, compose } from "@app/server";
import { AppError, authOrganization } from "@app/kernel";
import {
  addMember,
  archiveOrganization,
  createOrganization,
  hardDeleteOrganization,
  listMembers,
  listOrganizations,
  onOrganizationDelete,
} from "../src";

let t: TestDb;
let owner: Session;
let call: ReturnType<typeof requester>;

beforeAll(async () => {
  t = await createTestDb();
  call = requester(buildApi(t.ctx, compose(t.ctx)));
  owner = await ownerSession(t.ctx, { orgName: "Maple & Main" });
});
afterAll(() => t.teardown());

const actor = (s: Session) => ({ orgId: s.orgId, userId: s.userId });

describe("Organizations and their people", () => {
  test("the switcher lists the Organizations I belong to, with my role in each", async () => {
    const other = await ownerSession(t.ctx, { orgName: "Second" });
    await addMember(t.ctx, owner.orgId, other.userId, "editor");
    const mine = await call("GET", "/api/v1/me/organizations", { headers: other.headers });
    expect(mine.body.map((o: { name: string; role: string }) => [o.name, o.role])).toEqual([
      ["Maple & Main", "editor"],
      ["Second", "owner"],
    ]);
  });

  test("members are listed with who they are; pending invitations apart", async () => {
    const members = await listMembers(t.ctx, owner.orgId);
    expect(members.find((m) => m.userId === owner.userId)).toMatchObject({ role: "owner", email: owner.email, name: "Owner" });
    const invites = await call("GET", `/api/v1/organizations/${owner.orgId}/invitations`, { headers: owner.headers });
    expect(invites.body).toEqual([]);
  });

  test("an Owner changes the Organization's settings", async () => {
    expect(
      (
        await call("PATCH", `/api/v1/organizations/${owner.orgId}`, {
          headers: owner.headers,
          body: { name: "Maple", timezone: "Europe/London" },
        })
      ).status,
    ).toBe(200);
    const got = await call("GET", `/api/v1/organizations/${owner.orgId}`, { headers: owner.headers });
    expect(got.body).toMatchObject({ name: "Maple", timezone: "Europe/London", role: "owner" });
  });
});

describe("the platform admin area's view", () => {
  test("lists every Organization with its Owner's status, and creates one for an existing user or by invitation", async () => {
    const admin = await adminSession(t.ctx);
    const by = { userId: admin.userId, email: admin.email, name: "Admin" };
    const joined = await createOrganization(t.ctx, { name: "For owner", slug: "for-owner", ownerEmail: owner.email, by });
    expect(joined.owner).toEqual({ email: owner.email, status: "joined" });
    const invited = await createOrganization(t.ctx, { name: "For nobody yet", slug: "for-nobody", ownerEmail: "Nobody@App.test", by });
    expect(invited.owner).toEqual({ email: "nobody@app.test", status: "invited" });
    expect(invited.emailed).toBe(false); // the app can't send yet
    await expect(createOrganization(t.ctx, { name: "Dup", slug: "for-nobody", ownerEmail: "x@app.test", by })).rejects.toMatchObject({
      status: 409,
    });
    await expect(createOrganization(t.ctx, { name: "Bad", slug: "Bad Slug", ownerEmail: "x@app.test", by })).rejects.toMatchObject({
      status: 422,
    });

    const rows = await listOrganizations(t.ctx);
    expect(rows.find((r) => r.slug === "for-nobody")).toMatchObject({ owner: { status: "invited" }, members: 0 });
    expect(rows.find((r) => r.slug === "for-owner")).toMatchObject({ owner: { status: "joined", email: owner.email }, members: 1 });
  });
});

describe("archive and hard delete (schema.md)", () => {
  test("archiving hides the Organization from its members", async () => {
    const s = await ownerSession(t.ctx, { orgName: "Closing" });
    await archiveOrganization(t.ctx, actor(s), true);
    const [org] = await t.ctx.db.select().from(authOrganization).where(eq(authOrganization.id, s.orgId));
    expect(org!.archivedAt).not.toBeNull();
    expect((await call("GET", `/api/v1/organizations/${s.orgId}`, { headers: s.headers })).status).toBe(403);
  });

  test("hard delete needs the Organization archived first, then removes the Organization", async () => {
    const s = await ownerSession(t.ctx, { orgName: "Gone" });
    await expect(hardDeleteOrganization(t.ctx, actor(s))).rejects.toBeInstanceOf(AppError);
    let hookRan = false;
    onOrganizationDelete({
      name: "test.delete-hook",
      run: async () => {
        hookRan = true;
      },
    });
    await archiveOrganization(t.ctx, actor(s), true);
    await hardDeleteOrganization(t.ctx, actor(s));
    expect(hookRan).toBe(true);
    expect((await t.ctx.db.select().from(authOrganization).where(eq(authOrganization.id, s.orgId))).length).toBe(0);
  });
});

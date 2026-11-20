import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { adminSession, createTestDb, ownerSession, requester, type TestDb, type Session } from "@app/testkit";
import { compose, buildApi } from "@app/server";
import { addMember } from "@app/organizations";
import { upsertPlan } from "@app/billing";

let t: TestDb;
let app: ReturnType<typeof buildApi>;
let call: ReturnType<typeof requester>;
let owner: Session;

beforeAll(async () => {
  t = await createTestDb();
  const composed = compose(t.ctx);
  app = buildApi(t.ctx, composed);
  t.ctx.enqueue = async () => {};
  call = requester(app);
  owner = await ownerSession(t.ctx, { orgName: "Maple & Main" });
  // A default Plan that allows every feature, so switches (not the Plan) decide below.
  await upsertPlan(t.ctx, {
    id: "all",
    name: "All",
    default: true,
    entitlements: { "feature.assistant": 1, "feature.knowledge": 1, "feature.automation": 1 },
  });
});
afterAll(() => t.teardown());

async function signedInAs(orgRole: string, name: string) {
  // Put this person into the owner's Organization with the given role (invitations write the same row).
  const other = await ownerSession(t.ctx, { orgName: `${name} home` });
  await addMember(t.ctx, owner.orgId, other.userId, orgRole);
  return { headers: other.headers, userId: other.userId, orgId: owner.orgId };
}

describe("the API: who may call what", () => {
  test("health is open and lists the enabled modules", async () => {
    const r = await call("GET", "/health");
    expect(r.status).toBe(200);
    expect(r.body.modules).toContain("identity");
    expect(r.body.modules).toEqual(expect.arrayContaining(t.cfg.enabledModules));
  });

  test("the sign-in page learns which methods are on", async () => {
    const r = await call("GET", "/api/v1/auth/methods");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ emailAndPassword: true, google: false });
  });

  test("an organization route without a session is 401", async () => {
    expect((await call("GET", `/api/v1/organizations/${owner.orgId}`)).status).toBe(401);
    expect((await call("GET", "/api/v1/me")).body).toEqual({ signedIn: false });
  });

  test("a signed-in person who isn't a member of the organization is 403", async () => {
    const stranger = await ownerSession(t.ctx, { orgName: "Stranger" });
    const r = await call("GET", `/api/v1/organizations/${owner.orgId}`, { headers: stranger.headers });
    expect(r.status).toBe(403);
    expect(r.body.message).toContain("not a member");
  });

  test("a Viewer can read but not change the organization", async () => {
    const v = await signedInAs("viewer", "Viewer");
    expect((await call("GET", `/api/v1/organizations/${v.orgId}`, { headers: v.headers })).status).toBe(200);
    const r = await call("PATCH", `/api/v1/organizations/${v.orgId}`, { headers: v.headers, body: { name: "Hacked" } });
    expect(r.status).toBe(403);
    expect(r.body.message).toContain("viewer");
  });

  test("an Admin can't archive: that's the Owner's", async () => {
    const a = await signedInAs("admin", "Admin");
    expect((await call("POST", `/api/v1/organizations/${a.orgId}/archive`, { headers: a.headers })).status).toBe(403);
  });

  test("who am I: the session, and whether I'm an app admin", async () => {
    const me = await call("GET", "/api/v1/me", { headers: owner.headers });
    expect(me.body).toMatchObject({ signedIn: true, admin: false, user: { email: owner.email } });
    const admin = await adminSession(t.ctx);
    expect((await call("GET", "/api/v1/me", { headers: admin.headers })).body.admin).toBe(true);
  });
});

describe("the Admin area", () => {
  test("admin routes need an app admin: a member is 403, nobody is 401", async () => {
    expect((await call("GET", "/api/v1/admin/users")).status).toBe(401);
    expect((await call("GET", "/api/v1/admin/users", { headers: owner.headers })).status).toBe(403);
    const admin = await adminSession(t.ctx);
    const users = await call("GET", "/api/v1/admin/users", { headers: admin.headers });
    expect(users.status).toBe(200);
    expect(users.body.map((u: { email: string }) => u.email)).toContain(owner.email);
  });

  test("an admin lists Organizations with their Owner, and creates one with an invited Owner", async () => {
    const admin = await adminSession(t.ctx);
    const orgs = await call("GET", "/api/v1/admin/organizations", { headers: admin.headers });
    expect(orgs.body.find((o: { id: string }) => o.id === owner.orgId)).toMatchObject({ owner: { email: owner.email, status: "joined" } });
    const made = await call("POST", "/api/v1/admin/organizations", {
      headers: admin.headers,
      body: { name: "New Co", slug: "new-co", ownerEmail: "newbie@app.test" },
    });
    expect(made.status).toBe(200);
    expect(made.body).toMatchObject({ owner: { email: "newbie@app.test", status: "invited" }, emailed: false });
  });

  test("the app's settings come from the modules' manifests, as forms", async () => {
    const admin = await adminSession(t.ctx);
    const r = await call("GET", "/api/v1/admin/settings", { headers: admin.headers });
    expect(r.status).toBe(200);
    expect(r.body.map((s: { id: string }) => s.id)).toContain("messaging");
    expect(r.body[0].schema.type).toBe("object");
  });
});

describe("feature switches reach the routes", () => {
  test("turning a feature off in the organization shows in its statuses", async () => {
    const before = await call("GET", `/api/v1/organizations/${owner.orgId}/features`, { headers: owner.headers });
    expect(before.status).toBe(200);
    const [first] = Object.keys(before.body) as string[];
    await call("PATCH", `/api/v1/organizations/${owner.orgId}/features`, { headers: owner.headers, body: { [first!]: false } });
    const after = await call("GET", `/api/v1/organizations/${owner.orgId}/features`, { headers: owner.headers });
    expect(after.body[first!]).toMatchObject({ on: false, why: "turned off" });
  });
});

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createTestDb, ownerSession, requester, type TestDb, type Session } from "@openmarko/testkit";
import { compose, buildApi } from "@openmarko/platform";
import { addMember } from "@openmarko/organizations";
import { authFor } from "@openmarko/identity";
import { createLocation } from "@openmarko/organizations";

let t: TestDb;
let app: ReturnType<typeof buildApi>;
let call: ReturnType<typeof requester>;
let owner: Session;
const ADMIN = { "x-admin-token": "test-admin-token-0123456789abcdef0123456789" };

beforeAll(async () => {
  t = await createTestDb();
  const composed = compose(t.ctx);
  app = buildApi(t.ctx, composed);
  t.ctx.enqueue = async () => {};
  call = requester(app);
  owner = await ownerSession(t.ctx, { orgName: "Maple & Main Dental" });
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
    expect(r.body.modules).toContain("seo");
  });

  test("an organization route without a session is 401", async () => {
    const r = await call("GET", `/api/v1/organizations/${owner.orgId}`);
    expect(r.status).toBe(401);
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

  test("an Admin can't transfer out or archive: those are the Owner's", async () => {
    const a = await signedInAs("admin", "Admin");
    expect((await call("POST", `/api/v1/organizations/${a.orgId}/archive`, { headers: a.headers })).status).toBe(403);
    expect((await call("GET", `/api/v1/organizations/${a.orgId}/transfer-out`, { headers: a.headers })).status).toBe(403);
  });

  test("the Owner's transfer-out preview lists agency members (empty when there's no Partner)", async () => {
    const r = await call("GET", `/api/v1/organizations/${owner.orgId}/transfer-out`, { headers: owner.headers });
    expect(r.status).toBe(200);
    expect(r.body.members).toEqual([]);
  });
});

describe("feature switches and Plans reach the routes", () => {
  test("an SEO route is refused with 403 when the Plan doesn't include SEO", async () => {
    const loc = await createLocation(t.ctx, { orgId: owner.orgId, userId: owner.userId }, { name: "Gated" });
    const r = await call("GET", `/api/v1/organizations/${owner.orgId}/seo/locations/${loc}/profile`, { headers: owner.headers });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe("feature_off");
  });

  test("admin routes need the platform token", async () => {
    expect((await call("POST", "/api/v1/admin/plans", { body: { id: "x", name: "X", entitlements: {} } })).status).toBe(401);
    const ok = await call("POST", "/api/v1/admin/plans", {
      headers: new Headers(ADMIN),
      body: {
        id: "api-plan",
        name: "API plan",
        entitlements: {
          "feature.seo": 1,
          "feature.rankings": 1,
          "feature.site_health": 1,
          "feature.reviews": 1,
          "feature.ai_answers": 1,
          "feature.citations": 1,
          "feature.content": 1,
        },
        meters: [
          { meter: "dataforseo.request", included: null, overage: "charge", unitPriceMicros: 0 },
          { meter: "llm.tokens", included: null, overage: "charge", unitPriceMicros: 0 },
        ],
      },
    });
    expect(ok.status).toBe(200);
  });

  test("assigning the Plan by admin turns the SEO routes on for the Organization", async () => {
    const assigned = await call("POST", `/api/v1/admin/organizations/${owner.orgId}/plan`, {
      headers: new Headers(ADMIN),
      body: { planId: "api-plan" },
    });
    expect(assigned.status).toBe(200);
    const billing = await call("GET", `/api/v1/organizations/${owner.orgId}/billing`, { headers: owner.headers });
    expect(billing.body.planId).toBe("api-plan");
    expect(billing.body.entitlements["feature.seo"]).toBe(1);
    const features = await call("GET", `/api/v1/organizations/${owner.orgId}/features`, { headers: owner.headers });
    expect(features.body.seo.on).toBe(true);
  });

  test("turning a feature off in the organization stops its routes, and turning it on restores them", async () => {
    await call("PATCH", `/api/v1/organizations/${owner.orgId}/features`, { headers: owner.headers, body: { rankings: false } });
    const loc =
      (await call("GET", `/api/v1/organizations/${owner.orgId}/locations`, { headers: owner.headers })).body[0]?.id ??
      (await createLocation(t.ctx, { orgId: owner.orgId, userId: owner.userId }, { name: "Switch" }));
    const off = await call("GET", `/api/v1/organizations/${owner.orgId}/seo/locations/${loc}/keywords`, { headers: owner.headers });
    expect(off.status).toBe(403);
    await call("PATCH", `/api/v1/organizations/${owner.orgId}/features`, { headers: owner.headers, body: { rankings: true } });
    const on = await call("GET", `/api/v1/organizations/${owner.orgId}/seo/locations/${loc}/keywords`, { headers: owner.headers });
    expect(on.status).toBe(200);
  });
});

describe("the account sign-in is Better Auth's, mounted under /api/auth", () => {
  test("sign-up through the API creates a user", async () => {
    const auth = authFor(t.ctx);
    const r = await auth.api.signUpEmail({
      body: { email: `api-${crypto.randomUUID().slice(0, 6)}@maple.test`, password: "password-123", name: "Api" },
    });
    expect(r.user.id).toBeTruthy();
  });
});

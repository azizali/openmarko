import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createTestDb, ownerSession, requester, type TestDb, type Session } from "@openmarko/testkit";
import { compose, buildApi } from "@openmarko/platform";
import { addMember, addWebsite } from "@openmarko/organizations";

let t: TestDb;
let call: ReturnType<typeof requester>;
let owner: Session;
const ADMIN = new Headers({ "x-admin-token": "test-admin-token-0123456789abcdef0123456789" });

beforeAll(async () => {
  t = await createTestDb();
  call = requester(buildApi(t.ctx, compose(t.ctx)));
  owner = await ownerSession(t.ctx, { orgName: "Connections" });
});
afterAll(() => t.teardown());

const dfs = (orgId: string) => ({
  providerId: "dataforseo",
  target: { type: "organization", id: orgId },
  label: "DataForSEO",
  values: { login: "u", password: "p" },
});

describe("Settings → Integrations", () => {
  test("an Owner connects a provider, and the listing never shows its secret", async () => {
    const r = await call("POST", `/api/v1/organizations/${owner.orgId}/connections`, { headers: owner.headers, body: dfs(owner.orgId) });
    expect(r.status).toBe(200);
    const list = await call("GET", `/api/v1/organizations/${owner.orgId}/connections`, { headers: owner.headers });
    expect(list.body.map((c: { providerId: string }) => c.providerId)).toContain("dataforseo");
    expect(list.text).not.toContain("password");
    expect(list.text).not.toContain('"p"');
  });

  test("a Viewer can't connect a provider (it needs the capabilities' permission)", async () => {
    const viewer = await ownerSession(t.ctx, { orgName: "viewer home" });
    await addMember(t.ctx, owner.orgId, viewer.userId, "viewer");
    const r = await call("POST", `/api/v1/organizations/${owner.orgId}/connections`, { headers: viewer.headers, body: dfs(owner.orgId) });
    expect(r.status).toBe(403);
  });

  test("a connection can't point at another organization's website", async () => {
    const victim = await ownerSession(t.ctx, { orgName: "Victim" });
    const theirSite = await addWebsite(t.ctx, { orgId: victim.orgId, userId: victim.userId }, "victim.test");
    const r = await call("POST", `/api/v1/organizations/${owner.orgId}/connections`, {
      headers: owner.headers,
      body: {
        providerId: "wordpress",
        target: { type: "website", id: theirSite },
        label: "WP",
        values: { siteUrl: "https://attacker.test", username: "u", appPassword: "p" },
      },
    });
    expect(r.status).toBe(404);
  });

  test("an organization can't set the platform default model", async () => {
    const r = await call("POST", `/api/v1/organizations/${owner.orgId}/connections`, {
      headers: owner.headers,
      body: { providerId: "platform_llm", target: { type: "organization", id: owner.orgId }, label: "Mine", values: { apiKey: "k" } },
    });
    expect(r.status).toBe(422);
  });

  test("the platform default model is set with the admin token only", async () => {
    const body = { label: "Platform default", vendor: "anthropic", apiKey: "sk-ant-test-key" };
    expect((await call("POST", "/api/v1/admin/connections/platform-llm", { body })).status).toBe(401);
    expect((await call("POST", "/api/v1/admin/connections/platform-llm", { headers: ADMIN, body })).status).toBe(200);
  });

  test("disconnecting needs setup.connect and removes the connection from the list", async () => {
    const list = await call("GET", `/api/v1/organizations/${owner.orgId}/connections`, { headers: owner.headers });
    const id = (list.body as { id: string; providerId: string }[]).find((c) => c.providerId === "dataforseo")!.id;
    expect((await call("DELETE", `/api/v1/organizations/${owner.orgId}/connections/${id}`, { headers: owner.headers })).status).toBe(200);
    const after = await call("GET", `/api/v1/organizations/${owner.orgId}/connections`, { headers: owner.headers });
    expect(after.body.some((c: { id: string }) => c.id === id)).toBe(false);
  });
});

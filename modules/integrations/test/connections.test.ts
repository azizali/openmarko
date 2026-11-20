import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { adminSession, createTestDb, ownerSession, requester, type TestDb, type Session } from "@app/testkit";
import { compose, buildApi } from "@app/server";
import { addMember } from "@app/organizations";
import { connect } from "@app/integrations";

let t: TestDb;
let call: ReturnType<typeof requester>;
let owner: Session;

beforeAll(async () => {
  t = await createTestDb();
  call = requester(buildApi(t.ctx, compose(t.ctx)));
  owner = await ownerSession(t.ctx, { orgName: "Connections" });
});
afterAll(() => t.teardown());

const resend = { providerId: "resend", label: "Resend", values: { key: "re_secret" } };

describe("Settings → Integrations", () => {
  test("the catalog lists providers with their fields, for the connect forms", async () => {
    const r = await call("GET", `/api/v1/organizations/${owner.orgId}/connections/providers`, { headers: owner.headers });
    expect(r.status).toBe(200);
    expect(r.body.find((p: { id: string }) => p.id === "resend")).toMatchObject({
      category: "Email",
      fields: [{ key: "key", secret: true }],
    });
  });

  test("an Owner connects a provider, and the listing never shows its secret", async () => {
    const r = await call("POST", `/api/v1/organizations/${owner.orgId}/connections`, { headers: owner.headers, body: resend });
    expect(r.status).toBe(200);
    const list = await call("GET", `/api/v1/organizations/${owner.orgId}/connections`, { headers: owner.headers });
    expect(list.body.map((c: { providerId: string }) => c.providerId)).toContain("resend");
    expect(list.text).not.toContain("re_secret");
  });

  test("a Viewer can't connect a provider (it needs the capabilities' permission)", async () => {
    const viewer = await ownerSession(t.ctx, { orgName: "viewer home" });
    await addMember(t.ctx, owner.orgId, viewer.userId, "viewer");
    const r = await call("POST", `/api/v1/organizations/${owner.orgId}/connections`, { headers: viewer.headers, body: resend });
    expect(r.status).toBe(403);
  });

  test("a second email provider replaces the first (one sender per Organization)", async () => {
    await call("POST", `/api/v1/organizations/${owner.orgId}/connections`, {
      headers: owner.headers,
      body: { providerId: "postmark", label: "Postmark", values: { key: "pm" } },
    });
    const list = await call("GET", `/api/v1/organizations/${owner.orgId}/connections`, { headers: owner.headers });
    expect(
      list.body
        .filter((c: { capabilities: string[] }) => c.capabilities.includes("email.send"))
        .map((c: { providerId: string }) => c.providerId),
    ).toEqual(["postmark"]);
  });

  test("the app's own accounts are set by an admin only, and listed without secrets", async () => {
    const body = { providerId: "anthropic", values: { apiKey: "sk-ant-test-key" } };
    expect((await call("POST", "/api/v1/admin/connections", { body })).status).toBe(401);
    expect((await call("POST", "/api/v1/admin/connections", { headers: owner.headers, body })).status).toBe(403);
    const admin = await adminSession(t.ctx);
    expect((await call("POST", "/api/v1/admin/connections", { headers: admin.headers, body })).status).toBe(200);
    const list = await call("GET", "/api/v1/admin/connections", { headers: admin.headers });
    expect(list.body).toEqual([expect.objectContaining({ providerId: "anthropic", targetType: "app", label: "Anthropic" })]);
    expect(list.text).not.toContain("sk-ant");
    const providers = await call("GET", "/api/v1/admin/connections/providers", { headers: admin.headers });
    expect(providers.body[0].fields.some((f: { key: string }) => f.key === "webhookSecret")).toBe(true);
  });

  test("an Organization's own key is live, with no way to ask for anything else", async () => {
    const home = await ownerSession(t.ctx, { orgName: "Own key" });
    const url = `/api/v1/organizations/${home.orgId}/connections`;
    await call("POST", url, { headers: home.headers, body: { ...resend, mode: "stub" } });
    const list = await call("GET", url, { headers: home.headers });
    expect(list.body).toEqual([expect.objectContaining({ providerId: "resend", mode: "live" })]);
  });

  test("an admin chooses live or stub when connecting, and switches it later", async () => {
    const admin = await adminSession(t.ctx);
    const url = "/api/v1/admin/connections";
    const headers = admin.headers;
    const mode = async (providerId: string) =>
      (await call("GET", url, { headers })).body.find((c: { providerId: string }) => c.providerId === providerId);

    const made = await call("POST", url, { headers, body: { providerId: "openai", values: { apiKey: "sk-test" }, mode: "live" } });
    expect((await mode("openai")).mode).toBe("live");

    const body = { mode: "stub" };
    expect((await call("PATCH", `${url}/${made.body.id}`, { body })).status).toBe(401);
    expect((await call("PATCH", `${url}/${made.body.id}`, { headers: owner.headers, body })).status).toBe(403);
    expect((await call("PATCH", `${url}/${made.body.id}`, { headers, body })).status).toBe(200);
    expect((await mode("openai")).mode).toBe("stub");
    expect((await call("PATCH", `${url}/${made.body.id}`, { headers, body: { mode: "live" } })).status).toBe(200);
    expect((await mode("openai")).mode).toBe("live");
  });

  test("an account with no key can't go live, and one connected without a mode is a stub", async () => {
    const admin = await adminSession(t.ctx);
    const url = "/api/v1/admin/connections";
    const headers = admin.headers;
    const id = await connect(t.ctx, { organizationId: null, providerId: "google_ai", target: { type: "app", id: null }, label: "Google" });
    const row = (await call("GET", url, { headers })).body.find((c: { id: string }) => c.id === id);
    expect(row.mode).toBe("stub");
    const r = await call("PATCH", `${url}/${id}`, { headers, body: { mode: "live" } });
    expect(r.status).toBe(422);
    expect(r.text).toContain("no key");
  });

  test("disconnecting needs setup.connect and removes the connection from the list", async () => {
    const list = await call("GET", `/api/v1/organizations/${owner.orgId}/connections`, { headers: owner.headers });
    const id = (list.body as { id: string; providerId: string }[]).find((c) => c.providerId === "postmark")!.id;
    expect((await call("DELETE", `/api/v1/organizations/${owner.orgId}/connections/${id}`, { headers: owner.headers })).status).toBe(200);
    const after = await call("GET", `/api/v1/organizations/${owner.orgId}/connections`, { headers: owner.headers });
    expect(after.body.some((c: { id: string }) => c.id === id)).toBe(false);
  });
});

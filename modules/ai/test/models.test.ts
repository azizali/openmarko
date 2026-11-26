// Models by name through the AI SDK. Explicit `<vendor>/<model>`, or the app's custom name; the key is the vendor's
// Connection, the Organization's own first, else the app's. Stub Connections answer through the AI SDK's mock model.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { connect, languageModel } from "@app/integrations";
import { adminSession, composedApp, createTestDb, ownerSession, requester, type TestDb } from "@app/testkit";

let t: TestDb;
let call: ReturnType<typeof requester>;
let admin: Awaited<ReturnType<typeof adminSession>>;

const tryModel = (body: { model?: string; prompt: string }) => call("POST", "/api/v1/admin/ai/test", { headers: admin.headers, body });
const appKey = (providerId: "anthropic" | "openai") =>
  connect(t.ctx, {
    organizationId: null,
    providerId,
    target: { type: "app", id: null },
    label: providerId,
    secrets: { apiKey: "sk-test" },
  });

beforeAll(async () => {
  t = await createTestDb();
  call = requester(await composedApp(t.ctx));
  admin = await adminSession(t.ctx);
});
afterAll(() => t.teardown());

describe("models", () => {
  test("with no key for the vendor, it says what to connect", async () => {
    const res = await tryModel({ model: "openai/gpt-5-mini", prompt: "hi" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("needs_connection");
  });

  test("an explicit model answers through the app's key", async () => {
    await appKey("openai");
    const res = await tryModel({ model: "openai/gpt-5-mini", prompt: "hello there" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ model: "openai/gpt-5-mini", mode: "stub", text: expect.stringContaining("hello there") });
    expect(res.body.usage.totalTokens).toBeGreaterThan(0);
    expect((await tryModel({ model: "mistral/large", prompt: "x" })).status).toBe(422);
  });

  test("a custom name points at a model with its settings; the default is used when none is named", async () => {
    await appKey("anthropic");
    const bad = await call("PUT", "/api/v1/admin/settings/ai", {
      headers: admin.headers,
      body: { value: { defaultModel: "chat-pro", models: { "chat-pro": { model: "claude-without-vendor" } } } },
    });
    expect(bad.status).toBe(422);
    const ok = await call("PUT", "/api/v1/admin/settings/ai", {
      headers: admin.headers,
      body: { value: { defaultModel: "chat-pro", models: { "chat-pro": { model: "anthropic/claude-sonnet-5-5", temperature: 0.2 } } } },
    });
    expect(ok.status).toBe(200);
    expect((await tryModel({ model: "chat-pro", prompt: "hi" })).body).toMatchObject({
      name: "chat-pro",
      model: "anthropic/claude-sonnet-5-5",
    });
    expect((await tryModel({ prompt: "hi" })).body).toMatchObject({ name: "chat-pro", model: "anthropic/claude-sonnet-5-5" });
    expect((await tryModel({ model: "chat-max", prompt: "hi" })).status).toBe(422);
  });

  test("an Organization's own key comes first", async () => {
    const owner = await ownerSession(t.ctx, { orgName: "Brings its own key" });
    const own = await connect(t.ctx, {
      organizationId: owner.orgId,
      providerId: "anthropic",
      target: { type: "organization", id: owner.orgId },
      label: "Ours",
      secrets: { apiKey: "sk-own" },
    });
    expect((await languageModel(t.ctx, { organizationId: owner.orgId }, "anthropic/claude-haiku-5-5")).connectionId).toBe(own);
    expect((await languageModel(t.ctx, {}, "anthropic/claude-haiku-5-5")).connectionId).not.toBe(own);
  });

  test("a vendor's models are listed through the app's key; a stub lists a few fixed ones", async () => {
    const r = await call("GET", "/api/v1/admin/ai/vendors/openai/models", { headers: admin.headers });
    expect(r.status).toBe(200);
    expect(r.body).toContainEqual(expect.objectContaining({ id: "openai/gpt-5-mini", vendor: "openai", kind: "chat" }));
    expect(r.body).toContainEqual(expect.objectContaining({ id: "openai/text-embedding-3-small", kind: "embedding" }));
    expect((await call("GET", "/api/v1/admin/ai/vendors/google/models", { headers: admin.headers })).status).toBe(409);
    expect((await call("GET", "/api/v1/admin/ai/vendors/mistral/models", { headers: admin.headers })).status).toBe(422);
  });

  test("the platform admin area sees which vendors the app can reach", async () => {
    const { body } = await call("GET", "/api/v1/admin/ai", { headers: admin.headers });
    const by = Object.fromEntries((body.vendors as { vendor: string; connected: boolean }[]).map((v) => [v.vendor, v.connected]));
    expect(by).toEqual({ anthropic: true, openai: true, google: false, openrouter: false });
    expect(body.settings.defaultModel).toBe("chat-pro");
  });

  test("members see the app's model names and default, nothing more", async () => {
    const owner = await ownerSession(t.ctx, { orgName: "Models Co" });
    const res = await call("GET", `/api/v1/organizations/${owner.orgId}/ai/models`, { headers: owner.headers });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ default: "chat-pro", models: [{ name: "chat-pro", model: "anthropic/claude-sonnet-5-5" }] });
    expect((await call("GET", `/api/v1/organizations/${owner.orgId}/ai/models`)).status).toBe(401);
  });
});

// The chat widget. Anonymous visitors on an allowed website chat with an Organization's assistant, through a visitor
// token; Turnstile when the app has its keys.
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { connect } from "@app/integrations";
import { assignPlanManually, upsertPlan } from "@app/billing";
import { writeAppSetting } from "@app/settings";
import { addDocument, createBase, ingest, INGEST_JOB } from "@app/knowledge";
import { composedApp, createTestDb, ownerSession, requester, type TestDb } from "@app/testkit";
import { createAssistant, updateAssistant } from "../src/assistants";

const SITE = "https://maple.test";
let t: TestDb;
let app: Awaited<ReturnType<typeof composedApp>>;
let call: ReturnType<typeof requester>;
let assistantId: string;
let orgId: string;
let ownerHeaders: Headers;
const realFetch = globalThis.fetch;
afterEach(() => void (globalThis.fetch = realFetch));

/** A request from a visitor's browser on `origin`. */
const visitor = (method: string, path: string, opts: { origin?: string; token?: string; body?: unknown } = {}) =>
  call(method, path, {
    headers: new Headers({ origin: opts.origin ?? SITE, ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) }),
    body: opts.body,
  });

beforeAll(async () => {
  t = await createTestDb();
  app = await composedApp(t.ctx);
  call = requester(app);
  const queued: string[] = [];
  t.ctx.enqueue = async (name, data) => void (name === INGEST_JOB && queued.push(String(data.documentId)));
  await connect(t.ctx, {
    organizationId: null,
    providerId: "openai",
    target: { type: "app", id: null },
    label: "OpenAI",
    secrets: { apiKey: "sk-x" },
  });
  await writeAppSetting(t.ctx, "ai", { defaultModel: "openai/gpt-5-mini", models: {} });
  await upsertPlan(t.ctx, {
    id: "web",
    name: "Web",
    entitlements: {},
    meters: [{ meter: "llm.tokens", included: null, overage: "charge", unitPriceMicros: 0 }],
  });
  const owner = await ownerSession(t.ctx, { orgName: "Maple Dental" });
  orgId = owner.orgId;
  ownerHeaders = owner.headers;
  await assignPlanManually(t.ctx, orgId, "web");
  const base = await createBase(t.ctx, { orgId, userId: owner.userId }, { name: "Clinic" });
  await addDocument(t.ctx, { orgId, userId: owner.userId }, base.id, {
    title: "Opening hours",
    kind: "text",
    content: "We are closed on Sunday.",
  });
  for (const id of queued) await ingest(t.ctx, id);
  assistantId = (await createAssistant(t.ctx, { orgId, userId: owner.userId }, { name: "Front desk", knowledgeBaseIds: [base.id] })).id;
});
afterAll(() => t.teardown());

describe("the chat widget", () => {
  test("the code a website pastes loads the script from the API's own address", async () => {
    const listed = await call("GET", `/api/v1/organizations/${orgId}/ai/assistants`, { headers: ownerHeaders });
    const row = (listed.body as { id: string; embedCode: string }[]).find((a) => a.id === assistantId);
    expect(row?.embedCode).toBe(`<script src="${t.ctx.cfg.authUrl}/widget/v1.js" data-assistant="${assistantId}" async></script>`);
  });

  test("it's off until turned on, and then answers only on the websites it allows", async () => {
    expect((await visitor("GET", `/api/v1/widget/assistants/${assistantId}`)).status).toBe(404);
    await expect(
      updateAssistant(t.ctx, orgId, assistantId, { widget: { allowedOrigins: ["https://maple.test/page"] } }),
    ).rejects.toMatchObject({ status: 422 });
    // On with no website to answer on could never work, so it is refused with the reason.
    await expect(updateAssistant(t.ctx, orgId, assistantId, { widget: { enabled: true, allowedOrigins: [] } })).rejects.toMatchObject({
      status: 422,
    });
    await updateAssistant(t.ctx, orgId, assistantId, {
      widget: { enabled: true, allowedOrigins: [SITE], greeting: "Hello from Maple", accent: "#0a7d6e" },
    });

    const config = await visitor("GET", `/api/v1/widget/assistants/${assistantId}`);
    expect(config.body).toEqual({ name: "Front desk", greeting: "Hello from Maple", accent: "#0a7d6e", turnstileSiteKey: null });
    expect((await visitor("GET", `/api/v1/widget/assistants/${assistantId}`, { origin: "https://evil.test" })).status).toBe(403);
  });

  test("a visitor chats: the answer streams with its sources, readable by the website (CORS)", async () => {
    const session = (await visitor("POST", `/api/v1/widget/assistants/${assistantId}/sessions`, { body: {} })).body;
    expect(typeof session.conversationId).toBe("string");
    expect(typeof session.token).toBe("string");
    expect(session.expiresAt).toBeGreaterThan(Date.now());
    const res = await app.handle(
      new Request(`http://localhost:3000/api/v1/widget/conversations/${session.conversationId}/chat`, {
        method: "POST",
        headers: { host: "localhost:3000", origin: SITE, authorization: `Bearer ${session.token}`, "content-type": "application/json" },
        body: JSON.stringify({ text: "Are you open on Sunday?" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(SITE);
    const stream = await res.text();
    expect(stream).toContain('"text-delta"');
    expect(stream).toContain("Opening hours");
    await Bun.sleep(30);
    const history = (await visitor("GET", `/api/v1/widget/conversations/${session.conversationId}/messages`, { token: session.token }))
      .body;
    expect(history.map((m: { role: string }) => m.role)).toEqual(["user", "assistant"]);
    const { rows } = await t.ctx.pool.query(`select user_id from ai.conversations where id = $1`, [session.conversationId]);
    expect(rows[0].user_id).toMatch(/^visitor:/);
  });

  test("a visitor token is for its own conversation, and can't be made up", async () => {
    const a = (await visitor("POST", `/api/v1/widget/assistants/${assistantId}/sessions`, { body: {} })).body;
    const b = (await visitor("POST", `/api/v1/widget/assistants/${assistantId}/sessions`, { body: {} })).body;
    expect((await visitor("GET", `/api/v1/widget/conversations/${b.conversationId}/messages`, { token: a.token })).status).toBe(401);
    const [body] = a.token.split(".");
    expect((await visitor("GET", `/api/v1/widget/conversations/${a.conversationId}/messages`, { token: `${body}.forged` })).status).toBe(
      401,
    );
  });

  test("with Turnstile configured, a visitor needs to pass it first", async () => {
    t.ctx.cfg.turnstile = { siteKey: "0x4AAA", secretKey: "0x4BBB" };
    try {
      expect((await visitor("GET", `/api/v1/widget/assistants/${assistantId}`)).body.turnstileSiteKey).toBe("0x4AAA");
      expect((await visitor("POST", `/api/v1/widget/assistants/${assistantId}/sessions`, { body: {} })).status).toBe(403);
      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) =>
        String(url).startsWith("https://challenges.cloudflare.com/")
          ? Response.json({ success: (init!.body as FormData).get("response") === "good" })
          : realFetch(url, init)) as typeof fetch;
      expect((await visitor("POST", `/api/v1/widget/assistants/${assistantId}/sessions`, { body: { turnstileToken: "bad" } })).status).toBe(
        403,
      );
      expect(
        (await visitor("POST", `/api/v1/widget/assistants/${assistantId}/sessions`, { body: { turnstileToken: "good" } })).status,
      ).toBe(200);
    } finally {
      t.ctx.cfg.turnstile = null;
    }
  });

  test("any website may ask first (preflight); the script is served", async () => {
    const pre = await app.handle(
      new Request("http://localhost:3000/api/v1/widget/assistants/x", {
        method: "OPTIONS",
        headers: { host: "localhost:3000", origin: "https://anywhere.test" },
      }),
    );
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-origin")).toBe("https://anywhere.test");
    const js = await app.handle(new Request("http://localhost:3000/widget/v1.js", { headers: { host: "localhost:3000" } }));
    expect(js.headers.get("content-type")).toContain("javascript");
    expect(js.headers.get("cache-control")).toBe("no-store"); // outside production, so widget changes show at once
    const cfg = t.ctx.cfg as { nodeEnv: string };
    cfg.nodeEnv = "production";
    try {
      const live = await app.handle(new Request("http://localhost:3000/widget/v1.js", { headers: { host: "localhost:3000" } }));
      expect(live.headers.get("cache-control")).toContain("max-age");
    } finally {
      cfg.nodeEnv = "test";
    }
    expect((await js.text()).length).toBeGreaterThan(1000);
  });
});

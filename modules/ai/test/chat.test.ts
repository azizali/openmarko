// Members' conversations and streaming chat. The answer streams as the AI SDK's UI message stream; it's saved with
// its usage when it finishes, metered against the Organization's Plan (or as its own key's).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { connect } from "@app/integrations";
import { assignPlanManually, upsertPlan } from "@app/billing";
import { addMember } from "@app/organizations";
import { writeAppSetting } from "@app/settings";
import { composedApp, createTestDb, ownerSession, requester, type Session, type TestDb } from "@app/testkit";

let t: TestDb;
let app: Awaited<ReturnType<typeof composedApp>>;
let call: ReturnType<typeof requester>;
let owner: Session;

const base = (s: Session) => `/api/v1/organizations/${s.orgId}/ai/conversations`;
/** Sends a message and reads the whole stream, as a chat UI would. */
async function say(s: Session, conversationId: string, text: string) {
  const res = await app.handle(
    new Request(`http://localhost:3000${base(s)}/${conversationId}/chat`, {
      method: "POST",
      headers: { cookie: s.headers.get("cookie")!, origin: t.cfg.appUrl, host: "localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({ text }),
    }),
  );
  const body = await res.text();
  // The answer is saved when the stream finishes, just after the last byte.
  await Bun.sleep(30);
  return { status: res.status, type: res.headers.get("content-type") ?? "", body };
}

beforeAll(async () => {
  t = await createTestDb();
  app = await composedApp(t.ctx);
  call = requester(app);
  await connect(t.ctx, {
    organizationId: null,
    providerId: "openai",
    target: { type: "app", id: null },
    label: "OpenAI",
    secrets: { apiKey: "sk-x" },
  });
  await writeAppSetting(t.ctx, "ai", { defaultModel: "openai/gpt-5-mini", models: {} });
  await upsertPlan(t.ctx, {
    id: "chat",
    name: "Chat",
    entitlements: {},
    meters: [{ meter: "llm.tokens", included: null, overage: "charge", unitPriceMicros: 0 }],
  });
  owner = await ownerSession(t.ctx, { orgName: "Chats" });
  await assignPlanManually(t.ctx, owner.orgId, "chat");
});
afterAll(() => t.teardown());

describe("streaming chat", () => {
  let conversationId: string;

  test("a member's message gets a streamed answer, saved with its usage", async () => {
    conversationId = (await call("POST", base(owner), { headers: owner.headers, body: {} })).body.id;
    const res = await say(owner, conversationId, "What are your opening hours?");
    expect(res.status).toBe(200);
    expect(res.type).toContain("text/event-stream");
    expect(res.body).toContain('"type":"text-delta"');
    expect(res.body).toContain("opening");

    const msgs = (await call("GET", `${base(owner)}/${conversationId}/messages`, { headers: owner.headers })).body as {
      role: string;
      parts: { text: string }[];
      modelId: string | null;
      outputTokens: number | null;
    }[];
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(msgs[1]).toMatchObject({ modelId: "openai/gpt-5-mini" });
    expect(msgs[1]!.parts[0]!.text).toContain("What are your opening hours?");
    expect(msgs[1]!.outputTokens).toBeGreaterThan(0);

    const { rows } = await t.ctx.pool.query(`select meter, quantity from billing.usage_events where organization_id = $1`, [owner.orgId]);
    expect(rows).toEqual([expect.objectContaining({ meter: "llm.tokens" })]);
    expect(Number(rows[0].quantity)).toBeGreaterThan(0);

    const list = (await call("GET", base(owner), { headers: owner.headers })).body;
    expect(list[0]).toMatchObject({ id: conversationId, title: "What are your opening hours?" });
  });

  test("a second turn adds to the same conversation", async () => {
    await say(owner, conversationId, "And on Sundays?");
    const msgs = (await call("GET", `${base(owner)}/${conversationId}/messages`, { headers: owner.headers })).body;
    expect(msgs.map((m: { role: string }) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
  });

  test("a Plan that doesn't sell tokens stops the turn, unless the Organization brings its own key", async () => {
    const noTokens = await ownerSession(t.ctx, { orgName: "No tokens" });
    await upsertPlan(t.ctx, { id: "bare", name: "Bare", entitlements: {} });
    await assignPlanManually(t.ctx, noTokens.orgId, "bare");
    const c = (await call("POST", base(noTokens), { headers: noTokens.headers, body: {} })).body.id;
    expect((await say(noTokens, c, "hi")).status).toBe(402);

    await connect(t.ctx, {
      organizationId: noTokens.orgId,
      providerId: "openai",
      target: { type: "organization", id: noTokens.orgId },
      label: "Ours",
      secrets: { apiKey: "sk-own" },
    });
    const ok = await say(noTokens, c, "hi again");
    expect(ok.status).toBe(200);
    const { rows } = await t.ctx.pool.query(`select cost_micros, meta from billing.usage_events where organization_id = $1`, [
      noTokens.orgId,
    ]);
    expect(rows[0]).toMatchObject({ meta: expect.objectContaining({ byok: true }) });
    expect(Number(rows[0].cost_micros)).toBe(0);
  });

  test("conversations are private: another member can't read or chat in one, and only ai.history sees everyone's", async () => {
    const viewer = await ownerSession(t.ctx, { orgName: "Viewer's own" });
    await addMember(t.ctx, owner.orgId, viewer.userId, "viewer");
    const asViewer = { ...viewer, orgId: owner.orgId };
    expect((await call("GET", `${base(asViewer)}/${conversationId}/messages`, { headers: viewer.headers })).status).toBe(404);
    expect((await say(asViewer, conversationId, "let me in")).status).toBe(404);
    // A viewer may chat (their own conversations), but not see everyone's.
    expect((await call("POST", base(asViewer), { headers: viewer.headers, body: {} })).status).toBe(200);
    expect((await call("GET", `${base(asViewer)}?everyone=true`, { headers: viewer.headers })).status).toBe(403);
    const all = (await call("GET", `${base(owner)}?everyone=true`, { headers: owner.headers })).body as { userId: string }[];
    expect(new Set(all.map((c) => c.userId))).toEqual(new Set([owner.userId, viewer.userId]));
  });

  test("a conversation can be deleted, with its messages", async () => {
    expect((await call("DELETE", `${base(owner)}/${conversationId}`, { headers: owner.headers })).status).toBe(200);
    expect((await call("GET", `${base(owner)}/${conversationId}/messages`, { headers: owner.headers })).status).toBe(404);
  });
});

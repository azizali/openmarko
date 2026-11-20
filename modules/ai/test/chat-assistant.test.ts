// The widget the app's chat uses (ADR 0031). The nearest choice wins: the Organization's own, its Partner's, the app's,
// then the Organization's built-in starter. A widget offered from another Organization answers from its knowledge and
// model, is metered to its owner, and can't be used by anyone it isn't offered to.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { connect } from "@app/integrations";
import { assignPlanManually, upsertPlan, usageEvents } from "@app/billing";
import { authOrganization } from "@app/kernel";
import { addMember } from "@app/organizations";
import { writeAppSetting } from "@app/settings";
import { addDocument, createBase, ingest, INGEST_JOB } from "@app/knowledge";
import { adminSession, composedApp, createTestDb, ownerSession, requester, type Session, type TestDb } from "@app/testkit";

let t: TestDb;
let app: Awaited<ReturnType<typeof composedApp>>;
let call: ReturnType<typeof requester>;
let admin: Awaited<ReturnType<typeof adminSession>>;
let product: Session; // the product owner's Organization: builds the help bot
let helpBot: string;
let queued: string[] = [];

const ai = (s: Session) => `/api/v1/organizations/${s.orgId}/ai`;
const status = async (s: Session) => (await call("GET", `${ai(s)}/chat-assistant`, { headers: s.headers })).body;
const choose = (s: Session, assistantId: string | null, who: Session = s) =>
  call("PUT", `${ai(s)}/chat-assistant`, { headers: who.headers, body: { assistantId } });
const chooseForApp = (assistantId: string | null) =>
  call("PUT", "/api/v1/admin/ai/chat-assistant", { headers: admin.headers, body: { assistantId } });
const widget = async (s: Session, name: string) =>
  (await call("POST", `${ai(s)}/assistants`, { headers: s.headers, body: { name } })).body.id as string;
const customer = (orgName: string) => ownerSession(t.ctx, { orgName });

async function chatWith(s: Session, conversationId: string, text: string) {
  const res = await app.handle(
    new Request(`http://localhost:3000${ai(s)}/conversations/${conversationId}/chat`, {
      method: "POST",
      headers: { cookie: s.headers.get("cookie")!, origin: t.cfg.appUrl, host: "localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({ text }),
    }),
  );
  const body = await res.text();
  await Bun.sleep(30);
  return { status: res.status, body };
}

beforeAll(async () => {
  t = await createTestDb();
  app = await composedApp(t.ctx);
  call = requester(app);
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
    id: "ai",
    name: "AI",
    entitlements: {},
    meters: [{ meter: "llm.tokens", included: null, overage: "charge", unitPriceMicros: 0 }],
  });
  admin = await adminSession(t.ctx);
  product = await customer("Larkspur Coffee");
  await assignPlanManually(t.ctx, product.orgId, "ai");
  const base = await createBase(t.ctx, { orgId: product.orgId, userId: product.userId }, { name: "Help center" });
  await addDocument(t.ctx, { orgId: product.orgId, userId: product.userId }, base.id, {
    title: "Shipping",
    kind: "text",
    content: "Shipping is free on orders of 40 dollars or more in the contiguous United States.",
  });
  for (const id of queued.splice(0)) await ingest(t.ctx, id);
  helpBot = (
    await call("POST", `${ai(product)}/assistants`, { headers: product.headers, body: { name: "Help bot", knowledgeBaseIds: [base.id] } })
  ).body.id;
});
afterAll(() => t.teardown());

describe("the built-in widget", () => {
  test("every Organization has one, once: no instructions, the app's default model, never deleted", async () => {
    const org = await customer("Fresh");
    for (let i = 0; i < 2; i++) await call("GET", `${ai(org)}/assistants`, { headers: org.headers });
    const list = (await call("GET", `${ai(org)}/assistants`, { headers: org.headers })).body as Record<string, unknown>[];
    expect(list.filter((a) => a.builtin)).toEqual([expect.objectContaining({ name: "Assistant", instructions: "", model: null })]);
    const id = list.find((a) => a.builtin)!.id;
    const gone = await call("DELETE", `${ai(org)}/assistants/${id}`, { headers: org.headers });
    expect(gone.status).toBe(422);
    expect(gone.text).toContain("built-in");
  });

  test("with nothing chosen, an Organization's chat uses its built-in", async () => {
    const org = await customer("Nothing chosen");
    const s = await status(org);
    expect(s.inUse).toMatchObject({ level: "builtin", name: "Assistant" });
    expect(s).toMatchObject({ own: null, partner: null, app: null });
  });
});

describe("choosing the widget for an Organization", () => {
  test("it picks one of its own, and taking the choice back returns to the built-in", async () => {
    const org = await customer("Chooser");
    const mine = await widget(org, "Front desk");
    expect((await choose(org, mine)).body.inUse).toMatchObject({ assistantId: mine, level: "organization", name: "Front desk" });
    // Its colour goes with it, so the chat in the app looks like the widget; an untouched built-in keeps the app's own.
    await call("PATCH", `${ai(org)}/assistants/${mine}`, { headers: org.headers, body: { widget: { accent: "#1d4ed8" } } });
    expect((await status(org)).inUse.accent).toBe("#1d4ed8");
    const back = (await choose(org, null)).body.inUse;
    expect(back.level).toBe("builtin");
    expect(back.accent).toBeNull();
  });

  test("not another Organization's widget, and not without ai.configure", async () => {
    const org = await customer("Careful");
    expect((await choose(org, helpBot)).status).toBe(404);
    const viewer = await customer("Viewer home");
    await addMember(t.ctx, org.orgId, viewer.userId, "viewer");
    const asViewer = { ...viewer, orgId: org.orgId };
    expect((await choose(org, null, asViewer)).status).toBe(403);
    expect((await call("GET", `${ai(org)}/chat-assistant`, { headers: viewer.headers })).status).toBe(200);
  });

  test("deleting the chosen widget falls back instead of leaving a dead choice", async () => {
    const org = await customer("Deleter");
    const mine = await widget(org, "Temporary");
    await choose(org, mine);
    await call("DELETE", `${ai(org)}/assistants/${mine}`, { headers: org.headers });
    expect((await status(org)).inUse.level).toBe("builtin");
  });
});

describe("the app's choice, for everyone", () => {
  let member: Session;
  let conversationId: string;

  test("only an app admin makes it, and it reaches an Organization that chose nothing", async () => {
    member = await customer("A customer");
    expect((await call("PUT", "/api/v1/admin/ai/chat-assistant", { headers: member.headers, body: { assistantId: helpBot } })).status).toBe(
      403,
    );
    expect((await chooseForApp(crypto.randomUUID())).status).toBe(404);
    const done = await chooseForApp(helpBot);
    expect(done.body).toMatchObject({ assistantId: helpBot, name: "Help bot", organization: "Larkspur Coffee" });
    expect((await status(member)).inUse).toMatchObject({ assistantId: helpBot, level: "app", name: "Help bot" });
  });

  test("a customer chats with it: answered from the owner's knowledge, and metered to the owner", async () => {
    conversationId = (await call("POST", `${ai(member)}/conversations`, { headers: member.headers, body: { assistantId: helpBot } })).body
      .id;
    const turn = await chatWith(member, conversationId, "Is shipping free?");
    expect(turn.status).toBe(200);
    expect(turn.body).toContain("Shipping");
    const metered = async (orgId: string) =>
      (await t.ctx.db.select().from(usageEvents).where(eq(usageEvents.organizationId, orgId))).length;
    expect(await metered(product.orgId)).toBeGreaterThan(0);
    expect(await metered(member.orgId)).toBe(0);
  });

  test("the customer's conversation is theirs alone", async () => {
    const other = await customer("Another customer");
    expect((await call("GET", `${ai(other)}/conversations`, { headers: other.headers })).body).toEqual([]);
    expect((await call("GET", `${ai(other)}/conversations/${conversationId}/messages`, { headers: other.headers })).status).toBe(404);
  });

  test("a widget that isn't offered can't be used, even with its id", async () => {
    const secret = await widget(product, "Internal");
    const r = await call("POST", `${ai(member)}/conversations`, { headers: member.headers, body: { assistantId: secret } });
    expect(r.status).toBe(404);
  });

  test("an Organization's own choice beats the app's", async () => {
    const org = await customer("Has its own");
    const mine = await widget(org, "Ours");
    await choose(org, mine);
    const s = await status(org);
    expect(s.inUse).toMatchObject({ assistantId: mine, level: "organization" });
    expect(s.app).toMatchObject({ assistantId: helpBot });
  });

  test("when the app takes the choice back, an old chat stops with a reason instead of carrying on", async () => {
    await chooseForApp(null);
    expect((await status(member)).inUse.level).toBe("builtin");
    const turn = await chatWith(member, conversationId, "And to Canada?");
    expect(turn.status).toBe(409);
    expect(turn.body).toContain("Start a new chat");
  });
});

describe("an agency's choice, for its Clients", () => {
  test("a Client uses its Partner's widget; its own choice beats that, and the Partner's beats the app's", async () => {
    const agency = await customer("Brightline");
    const client = await customer("Acme Dental");
    await t.ctx.db.update(authOrganization).set({ partnerId: agency.orgId }).where(eq(authOrganization.id, client.orgId));
    await assignPlanManually(t.ctx, agency.orgId, "ai");

    const agencyBot = await widget(agency, "Agency bot");
    await choose(agency, agencyBot);
    expect((await status(client)).inUse).toMatchObject({ assistantId: agencyBot, level: "partner" });

    await chooseForApp(helpBot);
    expect((await status(client)).inUse).toMatchObject({ assistantId: agencyBot, level: "partner" });

    const conversation = await call("POST", `${ai(client)}/conversations`, { headers: client.headers, body: { assistantId: agencyBot } });
    expect(conversation.status).toBe(200);

    const clientBot = await widget(client, "Client bot");
    await choose(client, clientBot);
    expect((await status(client)).inUse).toMatchObject({ assistantId: clientBot, level: "organization" });
    expect((await status(client)).partner).toMatchObject({ assistantId: agencyBot });

    await choose(client, null);
    expect((await status(client)).inUse.level).toBe("partner");
    await chooseForApp(null);
  });
});

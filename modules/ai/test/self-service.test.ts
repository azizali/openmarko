// What a self-service chat app does over the API, with nothing assigned by an admin: someone signs up and makes an
// Organization (on the default Plan), adds a document to a knowledge base, makes one assistant with no model of its
// own, and chats in a conversation with the model they picked from the app's names; the answer streams with the
// document as its source.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { connect } from "@app/integrations";
import { upsertPlan } from "@app/billing";
import { writeAppSetting } from "@app/settings";
import { ingest, INGEST_JOB } from "@app/knowledge";
import { composedApp, createTestDb, ownerSession, requester, type Session, type TestDb } from "@app/testkit";

let t: TestDb;
let call: ReturnType<typeof requester>;
let me: Session;
const queued: string[] = [];
const mine = (path: string, body?: unknown, method = body === undefined ? "GET" : "POST") =>
  call(method, `/api/v1/organizations/${me.orgId}${path}`, { headers: me.headers, body });

beforeAll(async () => {
  t = await createTestDb();
  call = requester(await composedApp(t.ctx));
  t.ctx.enqueue = async (name, data) => void (name === INGEST_JOB && queued.push(String(data.documentId)));
  await connect(t.ctx, {
    organizationId: null,
    providerId: "openai",
    target: { type: "app", id: null },
    label: "OpenAI",
    secrets: { apiKey: "sk-x" },
  });
  await writeAppSetting(t.ctx, "ai", {
    defaultModel: "fast",
    models: { fast: { model: "openai/gpt-5-mini" }, smart: { model: "openai/gpt-5" } },
  });
  await upsertPlan(t.ctx, {
    id: "free",
    name: "Free",
    default: true,
    entitlements: {},
    meters: [{ meter: "llm.tokens", included: 1_000_000, overage: "block" }],
  });
  me = await ownerSession(t.ctx, { orgName: "Pat's chats" });
});
afterAll(() => t.teardown());

describe("a self-service chat app", () => {
  test("sign up, add a document, chat with a chosen model, answered from the document", async () => {
    expect((await mine("/ai/models")).body).toEqual({
      default: "fast",
      models: [
        { name: "fast", model: "openai/gpt-5-mini" },
        { name: "smart", model: "openai/gpt-5" },
      ],
    });
    const base = (await mine("/knowledge/bases", { name: "My documents" })).body;
    const doc = await mine(`/knowledge/bases/${base.id}/documents`, {
      title: "Office",
      kind: "text",
      content: "The office parrot is called Mango.",
    });
    expect(doc.status).toBe(200);
    for (const id of queued) await ingest(t.ctx, id);
    expect((await mine(`/knowledge/bases/${base.id}/documents`)).body[0].status).toBe("ready");

    const assistant = (await mine("/ai/assistants", { name: "Chat", knowledgeBaseIds: [base.id] })).body;
    const conv = (await mine("/ai/conversations", { assistantId: assistant.id, model: "smart", title: "Parrot" })).body;
    const res = await mine(`/ai/conversations/${conv.id}/chat`, { text: "What is the parrot called?" });
    expect(res.status).toBe(200);
    const stream = String(res.body);
    expect(stream).toContain('"documentTitle":"Office"');
    expect(stream).toContain(`"delta":"openai/gpt-5] "`); // the picked model, not the default (gpt-5-mini)
  });
});

// Assistants: a model, instructions and knowledge bases, owned by an Organization. Each turn retrieves from its bases
// and gives the model those passages; the answer keeps them as its sources.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { connect } from "@app/integrations";
import { assignPlanManually, upsertPlan } from "@app/billing";
import { addMember } from "@app/organizations";
import { writeAppSetting } from "@app/settings";
import { addDocument, createBase, ingest, INGEST_JOB } from "@app/knowledge";
import { adminSession, composedApp, createTestDb, ownerSession, requester, type Session, type TestDb } from "@app/testkit";

let t: TestDb;
let app: Awaited<ReturnType<typeof composedApp>>;
let call: ReturnType<typeof requester>;
let owner: Session;
let baseId: string;
let queued: string[] = [];

const drain = async () => {
  for (const id of queued.splice(0)) await ingest(t.ctx, id);
};
const ai = (s: Session) => `/api/v1/organizations/${s.orgId}/ai`;

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
  owner = await ownerSession(t.ctx, { orgName: "Maple Dental" });
  await assignPlanManually(t.ctx, owner.orgId, "ai");
  baseId = (await createBase(t.ctx, { orgId: owner.orgId, userId: owner.userId }, { name: "Clinic" })).id;
  await addDocument(t.ctx, { orgId: owner.orgId, userId: owner.userId }, baseId, {
    title: "Opening hours",
    kind: "text",
    content: "We are open Monday to Friday 9 to 5. Closed on Sunday.",
  });
  await addDocument(t.ctx, { orgId: owner.orgId, userId: owner.userId }, baseId, {
    title: "Prices",
    kind: "text",
    content: "Teeth whitening costs 300 dollars.",
  });
  await drain();
});
afterAll(() => t.teardown());

describe("assistants", () => {
  let assistantId: string;

  test("an Owner creates one; it can only use the Organization's own knowledge bases", async () => {
    const made = await call("POST", `${ai(owner)}/assistants`, {
      headers: owner.headers,
      body: { name: "Front desk", instructions: "You answer patients' questions about the clinic.", knowledgeBaseIds: [baseId] },
    });
    expect(made.status).toBe(200);
    assistantId = made.body.id;

    const other = await ownerSession(t.ctx, { orgName: "Elsewhere" });
    const theirs = await call("POST", `${ai(other)}/assistants`, {
      headers: other.headers,
      body: { name: "Thief", knowledgeBaseIds: [baseId] },
    });
    expect(theirs.status).toBe(404);
  });

  test("chatting with it retrieves from its knowledge: the stream and the saved answer carry the sources", async () => {
    const conv = await call("POST", `${ai(owner)}/conversations`, { headers: owner.headers, body: { assistantId } });
    const res = await app.handle(
      new Request(`http://localhost:3000${ai(owner)}/conversations/${conv.body.id}/chat`, {
        method: "POST",
        headers: { cookie: owner.headers.get("cookie")!, origin: t.cfg.appUrl, host: "localhost:3000", "content-type": "application/json" },
        body: JSON.stringify({ text: "Are you open on Sunday?" }),
      }),
    );
    const stream = await res.text();
    await Bun.sleep(30);
    expect(res.status).toBe(200);
    expect(stream).toContain('"messageMetadata"');
    expect(stream).toContain("Opening hours");

    const msgs = (await call("GET", `${ai(owner)}/conversations/${conv.body.id}/messages`, { headers: owner.headers })).body;
    const answer = msgs.find((m: { role: string }) => m.role === "assistant");
    expect(answer.sources[0]).toMatchObject({ documentTitle: "Opening hours", text: expect.stringContaining("Sunday") });
  });

  test("every member sees the assistants; only ai.configure changes them", async () => {
    const viewer = await ownerSession(t.ctx, { orgName: "Viewer home" });
    await addMember(t.ctx, owner.orgId, viewer.userId, "viewer");
    const asViewer = { ...viewer, orgId: owner.orgId };
    expect(
      (await call("GET", `${ai(asViewer)}/assistants`, { headers: viewer.headers })).body.map((a: { name: string }) => a.name),
    ).toContain("Front desk");
    expect(
      (await call("PATCH", `${ai(asViewer)}/assistants/${assistantId}`, { headers: viewer.headers, body: { name: "Mine now" } })).status,
    ).toBe(403);
    expect(
      (await call("PATCH", `${ai(owner)}/assistants/${assistantId}`, { headers: owner.headers, body: { instructions: "Be brief." } })).body,
    ).toMatchObject({
      instructions: "Be brief.",
      knowledgeBaseIds: [baseId],
    });
  });
});

describe("setting one up from the Admin area", () => {
  test("an admin picks an Organization, builds its knowledge, makes an assistant and tries it", async () => {
    const admin = await adminSession(t.ctx);
    const orgs = (await call("GET", "/api/v1/admin/organizations", { headers: admin.headers })).body as {
      id: string;
      name: string;
      members: number;
    }[];
    const clinic = orgs.find((o) => o.name === "Maple Dental")!;
    expect(clinic.members).toBeGreaterThan(0);

    const base = await call("POST", "/api/v1/admin/knowledge/bases", {
      headers: admin.headers,
      body: { organizationId: clinic.id, name: "FAQ" },
    });
    expect(base.status).toBe(200);
    await call("POST", `/api/v1/admin/knowledge/bases/${base.body.id}/documents`, {
      headers: admin.headers,
      body: { title: "Parking", kind: "markdown", content: "Parking is free behind the building." },
    });
    await drain();
    expect(
      (await call("GET", `/api/v1/admin/knowledge/bases/${base.body.id}/documents`, { headers: admin.headers })).body[0],
    ).toMatchObject({ status: "ready" });

    const made = await call("POST", "/api/v1/admin/ai/assistants", {
      headers: admin.headers,
      body: { organizationId: clinic.id, name: "FAQ bot", knowledgeBaseIds: [base.body.id] },
    });
    expect(made.status).toBe(200);
    const tried = await call("POST", `/api/v1/admin/ai/assistants/${made.body.id}/test`, {
      headers: admin.headers,
      body: { message: "Where can I park?" },
    });
    expect(tried.status).toBe(200);
    expect(tried.body).toMatchObject({
      model: "openai/gpt-5-mini",
      text: expect.stringContaining("park"),
      sources: [expect.objectContaining({ n: 1, documentTitle: "Parking" })],
    });
    expect(
      (await call("GET", "/api/v1/admin/ai/assistants", { headers: admin.headers })).body.map((a: { name: string }) => a.name),
    ).toEqual(expect.arrayContaining(["Front desk", "FAQ bot"]));
  });
});

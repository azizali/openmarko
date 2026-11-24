// A member's turn offers the tools their Role allows; the model's calls and what they returned stream to the chat and
// are saved with the answer, so the next turn's history keeps them (ADR 0036). The stub model calls a tool when told
// `/tool <name> {json}`.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { listTasks } from "@app/automation";
import { assignPlanManually, upsertPlan } from "@app/billing";
import { connect } from "@app/integrations";
import { addMember } from "@app/organizations";
import { writeAppSetting } from "@app/settings";
import { composedApp, createTestDb, ownerSession, requester, type Session, type TestDb } from "@app/testkit";

let t: TestDb;
let app: Awaited<ReturnType<typeof composedApp>>;
let call: ReturnType<typeof requester>;
let owner: Session;

const base = (s: Session) => `/api/v1/organizations/${s.orgId}/ai/conversations`;
async function say(s: Session, conversationId: string, text: string, page?: unknown) {
  const res = await app.handle(
    new Request(`http://localhost:3000${base(s)}/${conversationId}/chat`, {
      method: "POST",
      headers: { cookie: s.headers.get("cookie")!, origin: t.cfg.appUrl, host: "localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({ text, page }),
    }),
  );
  const body = await res.text();
  await Bun.sleep(30); // the answer is saved just after the last byte
  return { status: res.status, body };
}
type Part = { type: string; text?: string; toolName?: string; state?: string; output?: Record<string, unknown> };
const messages = async (s: Session, id: string) =>
  (await call("GET", `${base(s)}/${id}/messages`, { headers: s.headers })).body as { role: string; parts: Part[] }[];

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
  owner = await ownerSession(t.ctx, { orgName: "Tools" });
  await assignPlanManually(t.ctx, owner.orgId, "chat");
});
afterAll(() => t.teardown());

describe("tools in a member's turn", () => {
  test("a propose tool's call streams, is saved with the answer, and leaves a Task waiting for Apply", async () => {
    const id = (await call("POST", base(owner), { headers: owner.headers, body: {} })).body.id;
    const res = await say(owner, id, '/tool automation__rename_organization {"name":"Renamed by chat"}', {
      path: "/automation",
      params: {},
    });
    expect(res.status).toBe(200);
    expect(res.body).toContain('"type":"tool-output-available"');
    expect(res.body).toContain(`"delta":"returned: "`); // the stub reports what the tool returned

    const answer = (await messages(owner, id))[1]!;
    const tool = answer.parts.find((p) => p.type === "dynamic-tool")!;
    expect(tool).toMatchObject({ toolName: "automation__rename_organization", state: "output-available" });
    expect(tool.output).toMatchObject({ applied: false, title: 'Rename the organization to "Renamed by chat"' });
    expect(answer.parts.some((p) => p.type === "text" && p.text?.includes("returned"))).toBe(true);

    const task = (await listTasks(t.ctx, owner.orgId, "open")).find((x) => x.id === tool.output!.taskId);
    expect(task).toMatchObject({ createdByType: "assistant", createdBy: owner.userId });

    // The next turn reads that history back, tool parts included.
    const next = await say(owner, id, "thanks");
    expect(next.status).toBe(200);
    expect((await messages(owner, id)).map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
  });

  test("a tool the member's Role doesn't allow isn't offered, so nothing is proposed", async () => {
    const viewer = await ownerSession(t.ctx, { orgName: "Viewer's own" });
    await addMember(t.ctx, owner.orgId, viewer.userId, "viewer");
    const asViewer = { ...viewer, orgId: owner.orgId };
    const before = (await listTasks(t.ctx, owner.orgId, "open")).length;
    const id = (await call("POST", base(asViewer), { headers: viewer.headers, body: {} })).body.id;
    const res = await say(asViewer, id, '/tool automation__rename_organization {"name":"Not allowed"}');
    expect(res.status).toBe(200);
    expect(res.body).not.toContain("tool-output-available");
    expect((await listTasks(t.ctx, owner.orgId, "open")).length).toBe(before);
  });
});

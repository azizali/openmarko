// A member's chat gets the tools the enabled modules offer, less what their Role doesn't allow (ADR 0036). A `read`
// tool answers from the Organization's data; a `propose` tool proposes a Task, which waits for Apply unless Autopilot is on.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { callerFor } from "@app/access";
import { listTasks } from "@app/automation";
import { appConfig, toolsOf, type Caller } from "@app/kernel";
import { createTestDb, ownerSession, type TestDb } from "@app/testkit";
import { memberSystem, modelToolName, toolsFor } from "../src";

let t: TestDb;
let caller: Caller;
const call = { conversationId: crypto.randomUUID(), page: null };
const run = (c: Caller, name: string, input: unknown) =>
  toolsFor(t.ctx, c, call)[modelToolName(name)]!.execute!(input as never, { toolCallId: "t1", messages: [] } as never);

beforeAll(async () => {
  t = await createTestDb();
  const owner = await ownerSession(t.ctx);
  caller = await callerFor(t.ctx, owner.headers, owner.orgId);
});
afterAll(() => t.teardown());

describe("tools in a member's chat", () => {
  test("the composed modules' tools are gathered at boot", () => {
    expect(toolsOf(t.ctx).map((x) => x.name)).toEqual(
      expect.arrayContaining(["automation.recent_activity", "automation.rename_organization"]),
    );
  });

  test("the model sees names providers accept", () => {
    const names = Object.keys(toolsFor(t.ctx, caller, call));
    expect(names).toContain("automation__recent_activity");
    for (const n of names) expect(n).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
  });

  test("a member is offered only what their Role allows", () => {
    expect(Object.keys(toolsFor(t.ctx, { ...caller, permission: {} }, call))).toEqual([]);
    const viewer = { ...caller, permission: { activity: ["view"] } };
    expect(Object.keys(toolsFor(t.ctx, viewer, call))).toEqual(["automation__recent_activity"]);
  });

  test("a read tool answers from the Organization's data", async () => {
    const rows = (await run(caller, "automation.recent_activity", {
      limit: 5,
    })) as unknown[];
    expect(Array.isArray(rows)).toBe(true);
  });

  test("a propose tool proposes a Task and changes nothing until it's applied", async () => {
    const r = (await run(caller, "automation.rename_organization", {
      name: "Renamed in chat",
    })) as { taskId: string; applied: boolean };
    expect(r.applied).toBe(false);
    const task = (await listTasks(t.ctx, caller.orgId, "open")).find((x) => x.id === r.taskId);
    expect(task).toMatchObject({
      kind: "organization.rename",
      createdByType: "assistant",
      createdBy: caller.userId,
    });
  });
});

describe("what a member's chat is told", () => {
  test("what the app does, from the enabled modules' briefs, and never the app's name", () => {
    const briefs = t.ctx.catalog!.briefs;
    expect(briefs.map((b) => b.module)).toEqual(expect.arrayContaining(["automation", "seo"]));
    const system = memberSystem("Be brief.", {
      organization: "Maple & Main",
      briefs: briefs.map((b) => b.text),
      hasTools: true,
      page: { path: "/seo/maps", params: { location: "abc" } },
    });
    expect(system.startsWith("Be brief.")).toBe(true);
    expect(system).toContain('for the organization "Maple & Main"');
    expect(system).toContain("Google Maps");
    expect(system).toContain("Never send them to another product");
    expect(system).toContain("/seo/maps");
    expect(system).not.toContain(appConfig.name);
  });
});

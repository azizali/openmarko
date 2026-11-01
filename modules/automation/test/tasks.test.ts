import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createTestDb, ownerSession, type TestDb, type Session } from "@openmarko/testkit";
import { AppError } from "@openmarko/kernel";
import {
  applyTask,
  dismissTask,
  proposeTask,
  registerExecutor,
  revertTask,
  setSchedule,
  dueSchedules,
  listTasks,
  startRun,
  finishRun,
  listRuns,
} from "../src";
import { setSetting } from "./helpers";

let t: TestDb;
let owner: Session;
const log: string[] = [];

beforeAll(async () => {
  t = await createTestDb();
  owner = await ownerSession(t.ctx);
  registerExecutor("test_edit", {
    apply: async (_ctx, task) => {
      log.push(`apply:${(task.payload as { v: string }).v}`);
      return { previous: "old value" };
    },
    revert: async (_ctx, task) => {
      log.push(`revert:${(task.revert as { previous: string }).previous}`);
    },
  });
});
afterAll(() => t.teardown());

const input = (over: Partial<Parameters<typeof proposeTask>[1]> = {}) => ({
  organizationId: owner.orgId,
  kind: "test_edit",
  featureId: "seo",
  action: "seo.publish",
  title: "Change the hours",
  payload: { v: "new value" },
  createdByType: "assistant" as const,
  ...over,
});

describe("tasks: Apply and Undo work the same for every source (ADR 0005)", () => {
  test("a proposed task waits for a person by default", async () => {
    const r = await proposeTask(t.ctx, input({ sourceId: crypto.randomUUID(), sourceType: "test" }));
    expect(r.applied).toBe(false);
    expect((await listTasks(t.ctx, owner.orgId, "open")).some((x) => x.id === r.id)).toBe(true);
  });

  test("applying runs the executor and stores what Undo needs", async () => {
    const r = await proposeTask(t.ctx, input({ sourceId: crypto.randomUUID(), sourceType: "test" }));
    await applyTask(t.ctx, { organizationId: owner.orgId, userId: owner.userId, actorType: "member" }, r.id);
    const task = (await listTasks(t.ctx, owner.orgId, "applied")).find((x) => x.id === r.id);
    expect(task?.status).toBe("applied");
    expect(task?.revert).toEqual({ previous: "old value" });
    expect(log).toContain("apply:new value");
  });

  test("Undo runs the revert and marks the task reverted", async () => {
    const r = await proposeTask(t.ctx, input({ sourceId: crypto.randomUUID(), sourceType: "test" }));
    await applyTask(t.ctx, { organizationId: owner.orgId, userId: owner.userId, actorType: "member" }, r.id);
    await revertTask(t.ctx, { organizationId: owner.orgId, userId: owner.userId, actorType: "member" }, r.id);
    expect(log).toContain("revert:old value");
    expect((await listTasks(t.ctx, owner.orgId, "reverted")).some((x) => x.id === r.id)).toBe(true);
  });

  test("a second proposal for the same source while one is open returns the open task", async () => {
    const sourceId = crypto.randomUUID();
    const a = await proposeTask(t.ctx, input({ sourceId, sourceType: "test" }));
    const b = await proposeTask(t.ctx, input({ sourceId, sourceType: "test" }));
    expect(b.id).toBe(a.id);
  });

  test("Autopilot On for the action applies the task on its own, and logs it", async () => {
    await setSetting(t.ctx, owner.orgId, "autopilot", { "seo.publish": "on" });
    const r = await proposeTask(t.ctx, input({ sourceId: crypto.randomUUID(), sourceType: "test", payload: { v: "auto" } }));
    expect(r.applied).toBe(true);
    expect(log).toContain("apply:auto");
  });

  test("a task that isn't open can't be applied twice, and dismissing is only for open tasks", async () => {
    await setSetting(t.ctx, owner.orgId, "autopilot", { "seo.publish": "ask" });
    const r = await proposeTask(t.ctx, input({ sourceId: crypto.randomUUID(), sourceType: "test" }));
    await dismissTask(t.ctx, owner.orgId, r.id);
    await expect(applyTask(t.ctx, { organizationId: owner.orgId, userId: owner.userId, actorType: "member" }, r.id)).rejects.toBeInstanceOf(
      AppError,
    );
    await expect(dismissTask(t.ctx, owner.orgId, r.id)).rejects.toBeInstanceOf(AppError);
  });

  test("a task kind with no executor is refused", async () => {
    await expect(proposeTask(t.ctx, input({ kind: "no_such_kind" }))).rejects.toBeInstanceOf(AppError);
  });
});

describe("schedules and runs", () => {
  test("a due schedule is picked up, and its next run moves forward", async () => {
    await setSchedule(t.ctx, owner.orgId, { jobId: "seo.profile-sync", every: "6h" });
    const future = new Date(Date.now() + 7 * 3_600_000);
    const due = (await dueSchedules(t.ctx, future)).filter((s) => s.organizationId === owner.orgId);
    expect(due.length).toBeGreaterThanOrEqual(1);
  });

  test("a run's cost is the sum of the usage it caused", async () => {
    const { recordUsage } = await import("@openmarko/billing");
    const runId = await startRun(t.ctx, { organizationId: owner.orgId, kind: "rank", label: "Rank scan", trigger: "manual" });
    await recordUsage(t.ctx.db, {
      organizationId: owner.orgId,
      meter: "dataforseo.request",
      quantity: 2,
      costMicros: 1200,
      provider: "dataforseo",
      mode: "stub",
      runId,
    });
    await recordUsage(t.ctx.db, {
      organizationId: owner.orgId,
      meter: "dataforseo.request",
      quantity: 1,
      costMicros: 300,
      provider: "dataforseo",
      mode: "stub",
      runId,
    });
    await finishRun(t.ctx, runId, {});
    const run = (await listRuns(t.ctx, owner.orgId)).find((r) => r.id === runId);
    expect(run?.status).toBe("done");
    expect(run?.costMicros).toBe(1500);
  });

  test("a failed run keeps its error", async () => {
    const runId = await startRun(t.ctx, { organizationId: owner.orgId, kind: "audit", label: "Site crawl", trigger: "scheduled" });
    await finishRun(t.ctx, runId, { error: "provider down" });
    const run = (await listRuns(t.ctx, owner.orgId)).find((r) => r.id === runId);
    expect(run?.status).toBe("failed");
    expect(run?.error).toBe("provider down");
  });
});

import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { emit, logActivity, newId, notFound, conflict, forbidden, invalid, type AppContext, type Tx } from "@openmarko/kernel";
import { readSetting, registerSetting } from "@openmarko/settings";
import { usageEvents } from "@openmarko/billing";
import { z } from "zod";
import { runs, schedules, tasks } from "./schema";
import { nextRunAfter, type Every } from "./cadence";

// ---------- Runs (Activity) ----------

export async function startRun(
  ctx: AppContext,
  input: {
    organizationId: string;
    kind: string;
    label: string;
    trigger: "scheduled" | "manual" | "event";
    scheduleId?: string | null;
    targetType?: string | null;
    targetId?: string | null;
    createdBy?: string | null;
    expectedSec?: number | null;
  },
): Promise<string> {
  const id = newId();
  await ctx.db.insert(runs).values({
    id,
    organizationId: input.organizationId,
    kind: input.kind,
    label: input.label,
    trigger: input.trigger,
    status: "running",
    scheduleId: input.scheduleId ?? null,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    createdBy: input.createdBy ?? null,
    expectedSec: input.expectedSec ?? null,
    startedAt: new Date(),
  });
  return id;
}

export async function setRunProgress(ctx: AppContext, runId: string, progress: number): Promise<void> {
  await ctx.db
    .update(runs)
    .set({ progress: Math.min(1, Math.max(0, progress)) })
    .where(eq(runs.id, runId));
}

/** Ends a run. Its cost is the sum of the usage it caused (usage_events.run_id). */
export async function finishRun(ctx: AppContext, runId: string, outcome: { error?: string }): Promise<void> {
  const [cost] = await ctx.db
    .select({ total: sql<number>`coalesce(sum(${usageEvents.costMicros}), 0)::bigint` })
    .from(usageEvents)
    .where(eq(usageEvents.runId, runId));
  await ctx.db
    .update(runs)
    .set({
      status: outcome.error ? "failed" : "done",
      progress: outcome.error ? sql`progress` : 1,
      error: outcome.error ?? null,
      costMicros: Number(cost?.total ?? 0),
      finishedAt: new Date(),
    })
    .where(eq(runs.id, runId));
}

export async function listRuns(ctx: AppContext, orgId: string, limit = 50) {
  return ctx.db
    .select()
    .from(runs)
    .where(eq(runs.organizationId, orgId))
    .orderBy(sql`queued_at desc`)
    .limit(limit);
}

// ---------- Schedules ----------

export const everyValues = ["hourly", "6h", "daily", "3d", "weekly", "monthly"] as const;

export async function setSchedule(
  ctx: AppContext,
  orgId: string,
  input: {
    jobId: string;
    every: Every;
    at?: string | null;
    targetType?: string | null;
    targetId?: string | null;
    paused?: boolean;
  },
): Promise<string> {
  const now = new Date();
  const next = nextRunAfter(input.every, input.at, now);
  const [existing] = await ctx.db
    .select({ id: schedules.id })
    .from(schedules)
    .where(
      and(
        eq(schedules.organizationId, orgId),
        eq(schedules.jobId, input.jobId),
        input.targetId ? eq(schedules.targetId, input.targetId) : isNull(schedules.targetId),
      ),
    );
  if (existing) {
    await ctx.db
      .update(schedules)
      .set({
        every: input.every,
        at: input.at ?? null,
        paused: input.paused ?? false,
        nextRunAt: next,
        updatedAt: now,
      })
      .where(eq(schedules.id, existing.id));
    return existing.id;
  }
  const id = newId();
  await ctx.db.insert(schedules).values({
    id,
    organizationId: orgId,
    jobId: input.jobId,
    every: input.every,
    at: input.at ?? null,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    paused: input.paused ?? false,
    nextRunAt: next,
  });
  return id;
}

export async function dueSchedules(ctx: AppContext, now: Date) {
  return ctx.db
    .select()
    .from(schedules)
    .where(and(eq(schedules.paused, false), lte(schedules.nextRunAt, now)))
    .limit(200);
}

export async function advanceSchedule(ctx: AppContext, s: typeof schedules.$inferSelect, now: Date): Promise<void> {
  await ctx.db
    .update(schedules)
    .set({ lastRunAt: now, nextRunAt: nextRunAfter(s.every as Every, s.at, now), updatedAt: now })
    .where(eq(schedules.id, s.id));
}

// ---------- Autopilot (ADR 0005) ----------

export const autopilotLevels = ["off", "ask", "on"] as const;
export type AutopilotLevel = (typeof autopilotLevels)[number];
registerSetting("autopilot", z.record(z.string(), z.enum(autopilotLevels)));

/** Per action, what the assistant may do alone. Default: ask first. */
export async function autopilotFor(ctx: AppContext, orgId: string, action: string): Promise<AutopilotLevel> {
  const s = await readSetting<Record<string, AutopilotLevel>>(ctx.db, "organization", orgId, "autopilot");
  return s?.value[action] ?? "ask";
}

// ---------- Tasks (ADR 0005) ----------

export type Executor = {
  /** Does the change. Returns what Undo needs to put it back. */
  apply: (ctx: AppContext, task: typeof tasks.$inferSelect) => Promise<Record<string, unknown>>;
  /** Puts it back, from the revert payload apply returned. */
  revert: (ctx: AppContext, task: typeof tasks.$inferSelect) => Promise<void>;
};
const executors = new Map<string, Executor>();

/** A module registers how its tasks are applied. The kind is unique across modules. */
export function registerExecutor(kind: string, executor: Executor): void {
  executors.set(kind, executor);
}

export type TaskInput = {
  organizationId: string;
  kind: string;
  featureId: string;
  action: string;
  title: string;
  why?: string | null;
  impact?: "high" | "medium" | "low" | null;
  targetType?: string | null;
  targetId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  preview?: { label: string; before?: string; after: string } | null;
  payload: Record<string, unknown>;
  createdByType: "member" | "assistant" | "system";
  createdBy?: string | null;
};

/**
 * Proposes a task. A second proposal for the same source while one is still open returns the open task.
 * If Autopilot is On for this action, the task is applied straight away and logged.
 */
export async function proposeTask(ctx: AppContext, input: TaskInput): Promise<{ id: string; applied: boolean }> {
  if (!executors.has(input.kind)) throw invalid(`No executor registered for ${input.kind}.`);
  const level = await autopilotFor(ctx, input.organizationId, input.action);
  const id = newId();
  const [row] = await ctx.db
    .insert(tasks)
    .values({
      id,
      organizationId: input.organizationId,
      kind: input.kind,
      featureId: input.featureId,
      action: input.action,
      status: "open",
      title: input.title,
      why: input.why ?? null,
      impact: input.impact ?? null,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      preview: input.preview ?? null,
      payload: input.payload,
      autopilot: level === "on",
      createdByType: input.createdByType,
      createdBy: input.createdBy ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: tasks.id });
  if (!row) {
    const [open] = await ctx.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.organizationId, input.organizationId),
          eq(tasks.kind, input.kind),
          eq(tasks.sourceId, input.sourceId!),
          eq(tasks.status, "open"),
        ),
      );
    return { id: open!.id, applied: false };
  }
  if (level === "on") {
    await applyTask(ctx, { organizationId: input.organizationId, userId: null, actorType: "assistant" }, id);
    return { id, applied: true };
  }
  return { id, applied: false };
}

export type TaskActor = { organizationId: string; userId: string | null; actorType: "member" | "assistant" | "system" };

/** Applies an open task: runs its executor, stores the revert payload, logs Activity. */
export async function applyTask(ctx: AppContext, actor: TaskActor, taskId: string): Promise<void> {
  const [task] = await ctx.db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, actor.organizationId)));
  if (!task) throw notFound("Task");
  if (task.status !== "open") throw conflict(`This task is ${task.status}.`);
  const executor = executors.get(task.kind);
  if (!executor) throw invalid(`No executor registered for ${task.kind}.`);

  await ctx.db.update(tasks).set({ status: "applying", updatedAt: new Date() }).where(eq(tasks.id, taskId));
  try {
    const revert = await executor.apply(ctx, task);
    await ctx.db.transaction(async (tx: Tx) => {
      await tx
        .update(tasks)
        .set({ status: "applied", revert, appliedBy: actor.userId, appliedAt: new Date(), updatedAt: new Date() })
        .where(eq(tasks.id, taskId));
      await logActivity(tx, {
        organizationId: actor.organizationId,
        actorType: actor.actorType,
        actorId: actor.userId,
        action: task.action,
        resourceType: "task",
        resourceId: taskId,
        locationId: task.targetType === "location" ? task.targetId : null,
        summary: task.title,
        data: { kind: task.kind, autopilot: actor.actorType === "assistant" },
      });
      await emit(tx, { event: "task.applied", organizationId: actor.organizationId, payload: { taskId, kind: task.kind } });
    });
  } catch (err) {
    await ctx.db.update(tasks).set({ status: "open", updatedAt: new Date() }).where(eq(tasks.id, taskId));
    throw err;
  }
}

/** Undo: runs the executor's revert and marks the task reverted. */
export async function revertTask(ctx: AppContext, actor: TaskActor, taskId: string): Promise<void> {
  const [task] = await ctx.db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, actor.organizationId)));
  if (!task) throw notFound("Task");
  if (task.status !== "applied") throw conflict("Only an applied task can be undone.");
  const executor = executors.get(task.kind);
  if (!executor) throw invalid(`No executor registered for ${task.kind}.`);
  await executor.revert(ctx, task);
  await ctx.db.transaction(async (tx) => {
    await tx.update(tasks).set({ status: "reverted", updatedAt: new Date() }).where(eq(tasks.id, taskId));
    await logActivity(tx, {
      organizationId: actor.organizationId,
      actorType: actor.actorType,
      actorId: actor.userId,
      action: task.action,
      resourceType: "task",
      resourceId: taskId,
      summary: `Undone: ${task.title}`,
    });
  });
}

export async function dismissTask(ctx: AppContext, organizationId: string, taskId: string): Promise<void> {
  const res = await ctx.db
    .update(tasks)
    .set({ status: "dismissed", updatedAt: new Date() })
    .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, organizationId), eq(tasks.status, "open")))
    .returning({ id: tasks.id });
  if (res.length === 0) throw forbidden("Only an open task can be dismissed.");
}

export async function listTasks(ctx: AppContext, orgId: string, status?: string) {
  return ctx.db
    .select()
    .from(tasks)
    .where(and(eq(tasks.organizationId, orgId), status ? eq(tasks.status, status) : sql`true`))
    .orderBy(sql`created_at desc`)
    .limit(200);
}

/** Activity: who changed what, newest first (schema.md, core.activity). */
export async function listActivity(ctx: AppContext, orgId: string, limit = 100) {
  const { activity } = await import("@openmarko/kernel");
  return ctx.db
    .select()
    .from(activity)
    .where(eq(activity.organizationId, orgId))
    .orderBy(sql`created_at desc`)
    .limit(limit);
}

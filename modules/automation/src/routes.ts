import { Elysia, t } from "elysia";
import { AppError, ids, type AppContext } from "@app/kernel";
import { requireAllowed, allows, type Resource } from "@app/shared";
import {
  applyTask,
  dismissTask,
  executorKinds,
  listActivity,
  listRuns,
  listSchedules,
  listTasks,
  proposeTask,
  removeSchedule,
  revertTask,
  setSchedule,
} from "./service";
import { tasks } from "./schema";
import { and, eq } from "drizzle-orm";

/** The Action a task needs is stored as "resource.action", e.g. "organization.update". */
function actionOf(action: string): [Resource, string] {
  const [resource, act] = action.split(".");
  return [resource as Resource, act ?? ""];
}

async function taskFor(ctx: AppContext, orgId: string, taskId: string) {
  const [task] = await ctx.db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, orgId)));
  if (!task) throw new AppError(404, "not_found", "Task not found");
  return task;
}

/** Activity, runs, schedules and Tasks. A task's Apply, Undo and Dismiss use the permission of the task's own Action. */
export function automationRoutes(ctx: AppContext) {
  return new Elysia({ name: "automation" }).group("/api/v1/organizations/:orgId", (g) =>
    g
      .use(ctx.orgGuard!)
      .get(
        "/activity",
        async ({ caller }) => {
          requireAllowed(caller, "activity", "view");
          return listActivity(ctx, caller.orgId);
        },
        { detail: { summary: "List the activity log" } },
      )
      .get(
        "/runs",
        async ({ caller }) => {
          requireAllowed(caller, "activity", "view");
          return listRuns(ctx, caller.orgId);
        },
        { detail: { summary: "List runs (scheduled and manual jobs) with their cost" } },
      )
      .get(
        "/schedules",
        async ({ caller }) => {
          requireAllowed(caller, "autopilot", "view");
          return listSchedules(ctx, caller.orgId);
        },
        { detail: { summary: "List schedules: which jobs run on their own, and when" } },
      )
      .put(
        "/schedules",
        async ({ caller, body }) => {
          requireAllowed(caller, "autopilot", "edit");
          return { id: await setSchedule(ctx, caller.orgId, body) };
        },
        {
          body: t.Object({
            jobId: t.String({ minLength: 1, maxLength: 80 }),
            // Spelled out, so the typed client sees the values (a mapped union types as never).
            every: t.Union([
              t.Literal("hourly"),
              t.Literal("6h"),
              t.Literal("daily"),
              t.Literal("3d"),
              t.Literal("weekly"),
              t.Literal("monthly"),
            ]),
            at: t.Optional(t.Union([t.String({ pattern: "^\\d{2}:\\d{2}$" }), t.Null()])),
            targetType: t.Optional(t.Union([t.String(), t.Null()])),
            targetId: t.Optional(t.Union([t.String({ format: "uuid" }), t.Null()])),
            paused: t.Optional(t.Boolean()),
          }),
          detail: { summary: "Create or change a schedule for a job" },
        },
      )
      .delete(
        "/schedules/:scheduleId",
        async ({ caller, params }) => {
          requireAllowed(caller, "autopilot", "edit");
          await removeSchedule(ctx, caller.orgId, params.scheduleId);
          return { ok: true };
        },
        { params: ids("scheduleId"), detail: { summary: "Remove a schedule" } },
      )
      .get(
        "/tasks",
        async ({ caller, query }) => {
          // Show a task only to people who may see its feature (featureId is the resource).
          const rows = await listTasks(ctx, caller.orgId, query.status);
          return rows.filter((r) => allows(caller.permission, r.featureId as Resource, "view") || r.featureId === "organization");
        },
        { detail: { summary: "List tasks, filtered to those you can see" }, query: t.Object({ status: t.Optional(t.String()) }) },
      )
      .get("/tasks/kinds", () => executorKinds(), { detail: { summary: "The kinds of Task this app can apply" } })
      .post(
        "/tasks",
        async ({ caller, body }) => {
          const [resource, act] = actionOf(body.action);
          requireAllowed(caller, resource, act);
          return proposeTask(ctx, { ...body, organizationId: caller.orgId, createdByType: "member", createdBy: caller.userId });
        },
        {
          body: t.Object({
            kind: t.String({ minLength: 1, maxLength: 60 }),
            featureId: t.String({ minLength: 1 }),
            action: t.String({ pattern: "^[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*$" }),
            title: t.String({ minLength: 1, maxLength: 200 }),
            why: t.Optional(t.Union([t.String(), t.Null()])),
            impact: t.Optional(t.Union([t.Literal("high"), t.Literal("medium"), t.Literal("low"), t.Null()])),
            preview: t.Optional(t.Union([t.Object({ label: t.String(), before: t.Optional(t.String()), after: t.String() }), t.Null()])),
            payload: t.Record(t.String(), t.Unknown()),
          }),
          detail: { summary: "Propose a Task (applied at once if Autopilot is On for its Action)" },
        },
      )
      .post(
        "/tasks/:taskId/apply",
        async ({ caller, params }) => {
          const task = await taskFor(ctx, caller.orgId, params.taskId);
          const [resource, act] = actionOf(task.action);
          requireAllowed(caller, resource, act);
          await applyTask(ctx, { organizationId: caller.orgId, userId: caller.userId, actorType: "member" }, task.id);
          return { ok: true };
        },
        { detail: { summary: "Apply a task" }, params: ids("taskId") },
      )
      .post(
        "/tasks/:taskId/undo",
        async ({ caller, params }) => {
          const task = await taskFor(ctx, caller.orgId, params.taskId);
          const [resource, act] = actionOf(task.action);
          requireAllowed(caller, resource, act);
          await revertTask(ctx, { organizationId: caller.orgId, userId: caller.userId, actorType: "member" }, task.id);
          return { ok: true };
        },
        { detail: { summary: "Undo an applied task" }, params: ids("taskId") },
      )
      .post(
        "/tasks/:taskId/dismiss",
        async ({ caller, params }) => {
          const task = await taskFor(ctx, caller.orgId, params.taskId);
          const [resource, act] = actionOf(task.action);
          requireAllowed(caller, resource, act);
          await dismissTask(ctx, caller.orgId, task.id);
          return { ok: true };
        },
        { detail: { summary: "Dismiss a task" }, params: ids("taskId") },
      ),
  );
}

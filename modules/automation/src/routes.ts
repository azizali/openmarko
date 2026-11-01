import { Elysia, t } from "elysia";
import { AppError, ids, type AppContext } from "@openmarko/kernel";
import { requireAllowed, allows, type Resource } from "@openmarko/shared";
import { applyTask, dismissTask, listActivity, listRuns, listTasks, revertTask } from "./service";
import { tasks } from "./schema";
import { and, eq } from "drizzle-orm";

/** The Action a task needs is stored as "resource.action", e.g. "reviews.post". */
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

/** Activity, runs and To-do. A task's Apply, Undo and Dismiss use the permission of the task's own Action. */
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
        "/tasks",
        async ({ caller, query }) => {
          // Show a task only to people who may see its feature (featureId is the resource).
          const rows = await listTasks(ctx, caller.orgId, query.status);
          return rows.filter((r) => allows(caller.permission, r.featureId as Resource, "view"));
        },
        { detail: { summary: "List tasks, filtered to those you can see" }, query: t.Object({ status: t.Optional(t.String()) }) },
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
          const [resource] = actionOf(task.action);
          requireAllowed(caller, resource, "view");
          await dismissTask(ctx, caller.orgId, task.id);
          return { ok: true };
        },
        { detail: { summary: "Dismiss a task" }, params: ids("taskId") },
      ),
  );
}

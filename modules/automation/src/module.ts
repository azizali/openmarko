import { authOrganization, defineModule, logActivity, type AppContext, type JobDefinition } from "@app/kernel";
import { eq } from "drizzle-orm";
import { automationRoutes } from "./routes";
import { autopilotSchema, dueSchedules, advanceSchedule, startRun, registerExecutor } from "./service";

/**
 * Every minute: starts a Run for each due schedule and queues its job. Jobs read their target from the schedule
 * row; they check features and connections before doing work.
 */
export const scheduleTick = (ctx: AppContext): JobDefinition => ({
  name: "automation.tick",
  cron: "* * * * *",
  run: async (_data, { enqueue }) => {
    const now = new Date();
    for (const s of await dueSchedules(ctx, now)) {
      const runId = await startRun(ctx, {
        organizationId: s.organizationId,
        kind: s.jobId,
        label: s.jobId,
        trigger: "scheduled",
        scheduleId: s.id,
        targetType: s.targetType,
        targetId: s.targetId,
      });
      await advanceSchedule(ctx, s, now);
      await enqueue(
        s.jobId,
        { organizationId: s.organizationId, scheduleId: s.id, runId, targetId: s.targetId },
        { organizationId: s.organizationId },
      );
    }
  },
});

/**
 * The one Task kind the boilerplate ships: renaming the Organization, with Undo. It shows the whole loop (propose,
 * Autopilot, Apply, Undo, Activity) end to end; a real feature registers its own kinds the same way.
 */
function registerExamples(ctx: AppContext) {
  registerExecutor("organization.rename", {
    apply: async (c, task) => {
      const [org] = await c.db
        .select({ name: authOrganization.name })
        .from(authOrganization)
        .where(eq(authOrganization.id, task.organizationId));
      const name = String(task.payload.name ?? "").trim();
      if (!name) throw new Error("The task names no new name.");
      await c.db.update(authOrganization).set({ name }).where(eq(authOrganization.id, task.organizationId));
      return { name: org?.name ?? "" };
    },
    revert: async (c, task) => {
      const before = String(task.revert?.name ?? "");
      if (!before) return;
      await c.db.update(authOrganization).set({ name: before }).where(eq(authOrganization.id, task.organizationId));
    },
  });
  void ctx;
}

export const automationModule = defineModule({
  id: "automation",
  apiGroup: { name: "Automation", description: "Activity, runs, schedules and tasks (apply, undo, dismiss)." },
  dependsOn: ["organizations", "settings"],
  events: [{ id: "task.applied", label: "A task's change was applied" }],
  settings: [
    { id: "autopilot", label: "Per action, what the assistant may do on its own", schema: autopilotSchema, scopes: ["organization"] },
  ],
  roleGroups: [{ id: "automation", label: "Automation" }],
  permissions: [
    {
      id: "autopilot",
      label: "Autopilot & schedules",
      group: "automation",
      actions: [
        { id: "view", label: "See autopilot and schedules", tier: "view" },
        { id: "edit", label: "Change what runs on its own", tier: "manage" },
      ],
    },
    { id: "activity", label: "Activity", group: "automation", actions: [{ id: "view", label: "See the activity log", tier: "view" }] },
  ],
  setup: (ctx) => {
    registerExamples(ctx);
    return { routes: automationRoutes(ctx), jobs: [scheduleTick(ctx), exampleJob(ctx)] };
  },
});

/** A job a schedule can run: it writes one Activity line, so a schedule shows something happened. */
const exampleJob = (ctx: AppContext): JobDefinition => ({
  name: "example.heartbeat",
  perOrganization: true,
  run: async (data) => {
    const organizationId = String(data.organizationId ?? "");
    if (!organizationId) return;
    await ctx.db.transaction((tx) =>
      logActivity(tx, {
        organizationId,
        actorType: "system",
        action: "activity.view",
        resourceType: "run",
        resourceId: String(data.runId ?? ""),
        summary: "Heartbeat ran",
      }),
    );
    const { finishRun } = await import("./service");
    if (data.runId) await finishRun(ctx, String(data.runId), {});
  },
});

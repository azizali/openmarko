import { defineModule, type AppContext, type JobDefinition } from "@openmarko/kernel";
import { sql } from "drizzle-orm";
import { automationRoutes } from "./routes";
import { dueSchedules, advanceSchedule, startRun } from "./service";

/**
 * Every minute: starts a Run for each due schedule and queues its job. Jobs that need a Location or
 * Website read their target from the schedule row; they check features and connections before doing work.
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
      await enqueue(s.jobId, { organizationId: s.organizationId, scheduleId: s.id, runId, targetId: s.targetId });
    }
  },
});

/** Daily: creates the monthly partitions the growing tables need, a couple of months ahead (migration 0000). */
export const partitionMaintenance = (ctx: AppContext): JobDefinition => ({
  name: "automation.partitions",
  cron: "0 3 * * *",
  run: async () => {
    for (const [schema, table] of [
      ["core", "activity"],
      ["billing", "usage_events"],
      ["seo", "rank_snapshots"],
    ] as const) {
      await ctx.db.execute(sql`select public.ensure_month_partitions(${schema}, ${table}, 2)`);
    }
  },
});

export const automationModule = defineModule({
  id: "automation",
  dependsOn: ["billing", "settings"],
  setup: (ctx) => ({ routes: automationRoutes(ctx), jobs: [scheduleTick(ctx), partitionMaintenance(ctx)] }),
});

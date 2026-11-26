// The worker's SEO jobs:
//   seo.check          a check cycle for one Location: from its schedule (automation.tick starts the Run), or queued
//                      when keywords or questions are added (scoped to just those)
//   seo.collect        gathers one check's results: after posting, and on the provider's pingback
//   seo.collect-due    every minute: anything still waiting (the fallback, and how development works)
//   seo.profile-sync   daily: calls, clicks, views and searches from each linked Google profile
//   seo.prune          daily: drops raw results older than 30 days
// Every job checks the feature is on for the Organization before doing work.

import { and, eq, isNotNull } from "drizzle-orm";
import type { AppContext, JobDefinition } from "@app/kernel";
import { finishRun } from "@app/automation";
import { featureOn } from "@app/features";
import { FEATURE } from "../access";
import { syncProfileMetrics } from "../profile/service";
import { locations } from "../schema";
import { CHECK_JOB } from "../locations/service";
import { collectCheck, dueChecks, pruneRaw } from "./collect";
import { COLLECT_JOB, startCycle, type CycleScope } from "./cycle";

/** Checks what was just added to an active Location, without waiting for its next scheduled check. */
export async function queueScopedCheck(ctx: AppContext, orgId: string, locationId: string, scope: CycleScope): Promise<void> {
  if (!scope.keywordIds?.length && !scope.questionIds?.length) return;
  const [l] = await ctx.db.select({ status: locations.status }).from(locations).where(eq(locations.id, locationId));
  if (l?.status !== "active") return;
  await ctx.enqueue?.(CHECK_JOB, { organizationId: orgId, targetId: locationId, scope, trigger: "event" }, { organizationId: orgId });
}

export const checkJob = (ctx: AppContext): JobDefinition => ({
  name: CHECK_JOB,
  perOrganization: true,
  retry: { limit: 2, delaySeconds: 60 },
  run: async (data) => {
    const orgId = String(data.organizationId ?? "");
    const locationId = String(data.targetId ?? "");
    const runId = data.runId ? String(data.runId) : null;
    if (!orgId || !locationId) return;
    const [l] = await ctx.db
      .select({ status: locations.status })
      .from(locations)
      .where(and(eq(locations.id, locationId), eq(locations.organizationId, orgId)));
    const reason = !l
      ? "The location was removed."
      : l.status !== "active"
        ? "The location's checks are paused."
        : !(await featureOn(ctx, orgId, FEATURE))
          ? "SEO is off."
          : null;
    if (reason) {
      if (runId) await finishRun(ctx, runId, { error: reason });
      return;
    }
    await startCycle(ctx, orgId, locationId, {
      queue: data.queue === "priority" ? "priority" : "standard",
      runId,
      scope: (data.scope as CycleScope | undefined) ?? undefined,
      trigger: data.trigger === "event" ? "event" : "scheduled",
    });
  },
});

export const collectJob = (ctx: AppContext): JobDefinition => ({
  name: COLLECT_JOB,
  retry: { limit: 3, delaySeconds: 30 },
  run: async (data) => {
    if (data.checkId) await collectCheck(ctx, String(data.checkId), data.task ? String(data.task) : undefined);
  },
});

export const collectDueJob = (ctx: AppContext): JobDefinition => ({
  name: "seo.collect-due",
  cron: "* * * * *",
  run: async (_data, { enqueue }) => {
    for (const checkId of await dueChecks(ctx)) await enqueue(COLLECT_JOB, { checkId });
  },
});

export const profileSyncJob = (ctx: AppContext): JobDefinition => ({
  name: "seo.profile-sync",
  cron: "0 7 * * *",
  run: async () => {
    const linked = await ctx.db
      .select()
      .from(locations)
      .where(and(eq(locations.status, "active"), isNotNull(locations.gbpLocationName)));
    for (const l of linked) {
      if (!(await featureOn(ctx, l.organizationId, FEATURE))) continue;
      await syncProfileMetrics(ctx, l).catch((err) => console.error(`seo.profile-sync ${l.id}:`, err));
    }
  },
});

export const pruneJob = (ctx: AppContext): JobDefinition => ({
  name: "seo.prune",
  cron: "30 3 * * *",
  run: async () => pruneRaw(ctx),
});

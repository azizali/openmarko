import { eq } from "drizzle-orm";
import { AppError, type AppContext, type JobDefinition, type JobHelpers } from "@openmarko/kernel";
import { featureOn } from "@openmarko/features";
import { startRun, finishRun } from "@openmarko/automation";
import { activeLocations, activeWebsites, locationsWithProfile } from "./locations";
import { syncProfile, recordInsights } from "./profile";
import { scanRankings } from "./rankings";
import { checkAnswers } from "./ai";
import { runAudit } from "./audit";
import { checkCitations } from "./citations";
import { proposeReviewReply } from "./reviews";
import { reviews } from "./schema";
import { scanGrid } from "./grid";
import { checkBacklinks } from "./backlinks";

type JobData = {
  organizationId: string;
  runId?: string | null;
  targetId?: string | null;
  reviewId?: string;
  keyword?: string;
  size?: number;
};

/**
 * Wraps a job: skips quietly when its feature is off, records a Run for Activity, and stores the error if it fails.
 * Jobs carry the Organization; per-Location and per-Website work loops over what is active.
 */
function seoJob(
  ctx: AppContext,
  name: string,
  feature: "seo" | "rankings" | "ai_answers" | "site_health" | "citations" | "reviews",
  cron: string | undefined,
  work: (data: JobData, runId: string) => Promise<void>,
  kind = name,
): JobDefinition {
  return {
    name,
    cron,
    run: async (raw) => {
      const data = raw as unknown as JobData;
      if (!(await featureOn(ctx, data.organizationId, feature))) return;
      const runId =
        data.runId ??
        (await startRun(ctx, {
          organizationId: data.organizationId,
          kind,
          label: name,
          trigger: data.runId ? "scheduled" : "manual",
          targetType: null,
          targetId: data.targetId ?? null,
        }));
      try {
        await work(data, runId);
        await finishRun(ctx, runId, {});
      } catch (err) {
        await finishRun(ctx, runId, { error: err instanceof AppError ? err.message : String(err) });
        throw err;
      }
    },
  };
}

export function seoJobs(ctx: AppContext): JobDefinition[] {
  return [
    seoJob(ctx, "seo.profile-sync", "seo", "0 */6 * * *", async (d, runId) => {
      for (const l of await locationsWithProfile(ctx, d.organizationId, d.targetId)) {
        await syncProfile(ctx, d.organizationId, l.id, runId);
        await recordInsights(ctx, d.organizationId, l.id, new Date().toISOString().slice(0, 10), runId);
      }
    }),
    seoJob(ctx, "seo.rank-scan", "rankings", "0 6 * * *", async (d, runId) => {
      for (const l of await activeLocations(ctx, d.organizationId, d.targetId)) await scanRankings(ctx, d.organizationId, l.id, runId);
    }),
    seoJob(ctx, "seo.ai-check", "ai_answers", "0 9 * * 1", async (d, runId) => {
      for (const l of await activeLocations(ctx, d.organizationId, d.targetId)) await checkAnswers(ctx, d.organizationId, l.id, runId);
    }),
    seoJob(ctx, "seo.audit", "site_health", "0 5 * * 1", async (d, runId) => {
      for (const w of await activeWebsites(ctx, d.organizationId, d.targetId)) await runAudit(ctx, d.organizationId, w.id, runId);
    }),
    seoJob(ctx, "seo.citation-check", "citations", "0 7 * * 3", async (d, runId) => {
      for (const l of await activeLocations(ctx, d.organizationId, d.targetId)) await checkCitations(ctx, d.organizationId, l.id, runId);
    }),
    seoJob(ctx, "seo.grid-scan", "rankings", undefined, async (d, runId) => {
      if (!d.targetId || !d.keyword) return;
      await scanGrid(ctx, d.organizationId, d.targetId, d.keyword, { size: d.size }, runId);
    }),
    seoJob(ctx, "seo.backlinks", "citations", "0 8 * * 4", async (d, runId) => {
      for (const w of await activeWebsites(ctx, d.organizationId, d.targetId)) await checkBacklinks(ctx, d.organizationId, w.id, runId);
    }),
    // Queued when a low review arrives (see the review.received handler in module.ts).
    seoJob(
      ctx,
      "seo.review-reply-draft",
      "reviews",
      undefined,
      async (d) => {
        if (!d.reviewId) return;
        const [r] = await ctx.db.select().from(reviews).where(eq(reviews.id, d.reviewId));
        if (!r || r.reply) return;
        await proposeReviewReply(ctx, d.organizationId, d.reviewId, { userId: null, type: "assistant" });
      },
      "review_reply",
    ),
  ];
}

export type { JobHelpers };

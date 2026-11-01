import { defineModule, type AppContext } from "@openmarko/kernel";
import { seoRoutes } from "./routes";
import { seoJobs } from "./jobs";
import { registerSeoExecutors } from "./tasks";

/**
 * Local SEO (ADR 0008): Business Profile, reviews, rankings, AI answers, site health, citations and articles.
 * It reads and writes its own `seo` schema. Everything outside goes through integrations.invoke().
 */
export const seoModule = defineModule({
  id: "seo",
  dependsOn: ["organizations", "features", "integrations", "automation", "access"],
  setup: (ctx: AppContext) => {
    registerSeoExecutors();
    return {
      routes: seoRoutes(ctx),
      handlers: [
        {
          event: "review.received",
          name: "seo.low-rating-draft",
          // Low reviews get a draft reply straight away. Queued, so the outbox transaction stays short.
          fn: async (_tx, e) => {
            const rating = Number(e.payload.rating ?? 5);
            if (rating > 2 || !e.organizationId || !ctx.enqueue) return;
            await ctx.enqueue("seo.review-reply-draft", { organizationId: e.organizationId, reviewId: e.payload.reviewId });
          },
        },
      ],
      jobs: seoJobs(ctx),
    };
  },
});

import { and, eq, desc } from "drizzle-orm";
import { invalid, notFound, type AppContext } from "@openmarko/kernel";
import { invoke } from "@openmarko/integrations";
import { proposeTask } from "@openmarko/automation";
import { reviews } from "./schema";
import { activeLocation } from "./locations";

export async function listReviews(ctx: AppContext, orgId: string, locationId: string) {
  await activeLocation(ctx, orgId, locationId);
  return ctx.db
    .select()
    .from(reviews)
    .where(and(eq(reviews.organizationId, orgId), eq(reviews.locationId, locationId)))
    .orderBy(desc(reviews.reviewedAt))
    .limit(200);
}

async function reviewFor(ctx: AppContext, orgId: string, reviewId: string) {
  const [r] = await ctx.db
    .select()
    .from(reviews)
    .where(and(eq(reviews.id, reviewId), eq(reviews.organizationId, orgId)));
  if (!r) throw notFound("Review");
  return r;
}

/**
 * Drafts a reply with the model and proposes it as a review_reply Task. The Task applies on its own when
 * Autopilot is On for reviews.post, and waits for a person otherwise (ADR 0005).
 */
export async function proposeReviewReply(
  ctx: AppContext,
  orgId: string,
  reviewId: string,
  actor: { userId: string | null; type: "member" | "assistant" | "system" },
) {
  const r = await reviewFor(ctx, orgId, reviewId);
  const loc = await activeLocation(ctx, orgId, r.locationId);
  const prompt = [
    `Write a short, warm reply to this ${r.rating}-star Google review for "${loc.name}".`,
    "Thank them, address anything specific, never mention health details, and sign off with the practice name.",
    `Review: ${r.text || "(no text)"}`,
  ].join("\n");
  const { output } = await invoke<{ text: string }>(ctx, orgId, "llm.complete", { prompt });
  return proposeTask(ctx, {
    organizationId: orgId,
    kind: "review_reply",
    featureId: "reviews",
    action: "reviews.post",
    title: `Reply to a ${r.rating}★ review`,
    why: r.text ? `“${r.text.slice(0, 140)}”` : "A review with no text",
    impact: r.rating <= 2 ? "high" : "medium",
    targetType: "location",
    targetId: r.locationId,
    sourceType: "review",
    sourceId: r.id,
    preview: { label: "Reply", after: output.text },
    payload: { reviewId: r.id, locationId: r.locationId, text: output.text },
    createdByType: actor.type,
    createdBy: actor.userId,
  });
}

/** Posts the reply on Google and records it locally. Undo puts the previous reply back. */
export async function postReviewReply(ctx: AppContext, reviewId: string, text: string): Promise<{ previousReply: string | null }> {
  const [r] = await ctx.db.select().from(reviews).where(eq(reviews.id, reviewId));
  if (!r) throw notFound("Review");
  const loc = await activeLocation(ctx, r.organizationId, r.locationId);
  if (!loc.gbpConnectionId) throw invalid("This review's Location has no Google Business Profile.");
  await invoke(
    ctx,
    r.organizationId,
    "reviews.reply",
    { reviewName: r.externalId, reviewId: r.externalId, text },
    { connectionId: loc.gbpConnectionId },
  );
  await ctx.db.update(reviews).set({ reply: text, repliedAt: new Date() }).where(eq(reviews.id, reviewId));
  return { previousReply: r.reply };
}

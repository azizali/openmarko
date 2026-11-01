import { and, eq } from "drizzle-orm";
import { conflict, emit, logActivity, newId, type AppContext } from "@openmarko/kernel";
import { connect, disconnect, invoke } from "@openmarko/integrations";
import { setLocationGbp } from "@openmarko/organizations";
import { locations } from "@openmarko/organizations/schema";
import { reviews, profileInsights } from "./schema";
import { activeLocation, profileGuard } from "./locations";
import type { GbpReview } from "./gbp-types";

/**
 * Connects a Google Business Profile to a Location. The Google account that manages it is an Integration
 * Connection, separate from the Member's sign-in (schema.md).
 */
export async function connectProfile(
  ctx: AppContext,
  actor: { orgId: string; userId: string },
  locationId: string,
  input: { gbpId: string; label: string; accessToken?: string; refreshToken?: string },
): Promise<string> {
  const loc = await activeLocation(ctx, actor.orgId, locationId);
  if (loc.gbpId) throw conflict("This Location already has a Google Business Profile connected.");
  const connectionId = await connect(ctx, {
    organizationId: actor.orgId,
    providerId: "gbp",
    target: { type: "location", id: locationId },
    externalId: input.gbpId,
    label: input.label,
    secrets: input.accessToken ? { accessToken: input.accessToken, refreshToken: input.refreshToken ?? "" } : undefined,
    createdBy: actor.userId,
  });
  try {
    await ctx.db.transaction((tx) => setLocationGbp(tx, actor.orgId, locationId, input.gbpId, connectionId));
  } catch (err) {
    await disconnect(ctx, actor.orgId, connectionId, actor.userId);
    throw err;
  }
  return connectionId;
}

export async function disconnectProfile(ctx: AppContext, actor: { orgId: string; userId: string }, locationId: string): Promise<void> {
  const loc = await activeLocation(ctx, actor.orgId, locationId);
  if (!loc.gbpConnectionId) return;
  await disconnect(ctx, actor.orgId, loc.gbpConnectionId, actor.userId);
  await ctx.db.update(locations).set({ gbpId: null, gbpConnectionId: null, updatedAt: new Date() }).where(eq(locations.id, locationId));
}

/**
 * Pulls reviews for one Location. A review we haven't seen emits `review.received` in the same transaction
 * as the insert, so the outbox delivers it exactly as the insert happened (ADR 0009).
 */
export async function syncProfile(
  ctx: AppContext,
  orgId: string,
  locationId: string,
  runId: string | null = null,
): Promise<{ newReviews: number }> {
  const loc = await activeLocation(ctx, orgId, locationId);
  profileGuard(loc);
  const { output } = await invoke<GbpReview[]>(ctx, orgId, "reviews.read", {}, { connectionId: loc.gbpConnectionId!, runId });

  let fresh = 0;
  for (const r of output) {
    await ctx.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: reviews.id, reply: reviews.reply })
        .from(reviews)
        .where(and(eq(reviews.locationId, locationId), eq(reviews.externalId, r.reviewId)));
      if (existing) {
        if (r.reply && existing.reply !== r.reply) {
          await tx.update(reviews).set({ reply: r.reply, repliedAt: new Date() }).where(eq(reviews.id, existing.id));
        }
        return;
      }
      const id = newId();
      await tx.insert(reviews).values({
        id,
        organizationId: orgId,
        locationId,
        externalId: r.reviewId,
        rating: r.rating,
        text: r.text,
        author: r.author,
        reviewedAt: new Date(r.createdAt),
        reply: r.reply,
        repliedAt: r.reply ? new Date() : null,
      });
      await emit(tx, { event: "review.received", organizationId: orgId, payload: { reviewId: id, locationId, rating: r.rating } });
      fresh++;
    });
  }
  await ctx.db.transaction(async (tx) => {
    await logActivity(tx, {
      organizationId: orgId,
      actorType: "system",
      action: "reviews.read",
      resourceType: "location",
      resourceId: locationId,
      locationId,
      summary: `Synced reviews: ${fresh} new`,
    });
  });
  return { newReviews: fresh };
}

/** Insights for one day. Stub data for now; the live Performance API is in the adapter. */
export async function recordInsights(ctx: AppContext, orgId: string, locationId: string, day: string, runId: string | null): Promise<void> {
  const loc = await activeLocation(ctx, orgId, locationId);
  profileGuard(loc);
  const { output } = await invoke<{ calls: number; directions: number; searches: number }>(
    ctx,
    orgId,
    "profile.insights",
    {},
    { connectionId: loc.gbpConnectionId!, runId },
  );
  await ctx.db
    .insert(profileInsights)
    .values({ id: newId(), organizationId: orgId, locationId, day, ...output })
    .onConflictDoUpdate({ target: [profileInsights.locationId, profileInsights.day], set: { ...output } });
}

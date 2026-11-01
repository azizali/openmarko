import { and, eq } from "drizzle-orm";
import { invalid, newId, type AppContext } from "@openmarko/kernel";
import { invoke } from "@openmarko/integrations";
import { activeLocation } from "./locations";
import { reviewRequests } from "./schema";

/**
 * Asks a customer for a review by email. Needs the sending integration connected for the Organization (email.send),
 * and a Place ID on the Location so the link goes to the right listing.
 */
export async function sendReviewRequest(
  ctx: AppContext,
  orgId: string,
  locationId: string,
  input: { email: string; name?: string | null },
  userId: string | null,
): Promise<string> {
  const loc = await activeLocation(ctx, orgId, locationId);
  if (!loc.placeId) throw invalid("This Location has no Place ID yet, so there's no review link to send.");
  const link = `https://search.google.com/local/writereview?placeid=${encodeURIComponent(loc.placeId)}`;
  const body = `Hi${input.name ? ` ${input.name}` : ""}, thanks for visiting ${loc.name}. If you have a minute, we'd love a review: ${link}`;
  const { output } = await invoke<{ messageId: string }>(ctx, orgId, "email.send", {
    to: input.email,
    subject: `How was your visit to ${loc.name}?`,
    body,
  });
  const id = newId();
  await ctx.db.insert(reviewRequests).values({
    id,
    organizationId: orgId,
    locationId,
    recipientEmail: input.email,
    recipientName: input.name ?? null,
    status: "sent",
    messageId: output.messageId,
    createdBy: userId,
  });
  return id;
}

export async function listReviewRequests(ctx: AppContext, orgId: string, locationId: string) {
  return ctx.db
    .select()
    .from(reviewRequests)
    .where(and(eq(reviewRequests.organizationId, orgId), eq(reviewRequests.locationId, locationId)));
}

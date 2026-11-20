import { AppError, authOrganization, billingOf, type AppContext } from "@app/kernel";
import { eq } from "drizzle-orm";
import type { FeatureId } from "@app/shared";
import { statusOf } from "./status";

/** Throws 403 unless the feature is on for the Organization (module, Plan, switch, needs). Jobs call this before any work. */
export async function assertFeatureOn(ctx: AppContext, orgId: string, feature: FeatureId): Promise<void> {
  const [org] = await ctx.db.select({ features: authOrganization.features }).from(authOrganization).where(eq(authOrganization.id, orgId));
  const billing = billingOf(ctx);
  const s = statusOf(feature, (org?.features as Record<string, boolean>) ?? {}, await billing.entitlementsFor(orgId), billing);
  if (!s.on) throw new AppError(403, "feature_off", `This feature is off (${s.why}).`, { feature, why: s.why });
}

/** Non-throwing form for jobs that skip quietly when a feature is off. */
export async function featureOn(ctx: AppContext, orgId: string, feature: FeatureId): Promise<boolean> {
  try {
    await assertFeatureOn(ctx, orgId, feature);
    return true;
  } catch {
    return false;
  }
}

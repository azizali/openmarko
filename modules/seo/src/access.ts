// Who may do what in SEO, and what the Plan allows. One permission resource, `seo`, with an action per level:
//   view     see every page
//   track    add or remove keywords, questions and competitors; act on "track" and "get listed" suggestions
//   publish  apply changes and posts to the Google profile, and undo them (they go out under the business's name)
//   manage   add Locations, change what checks cost (grid, how often, engines), link the Google profile
// The Plan sells SEO through limits (Q5, Q9): Locations, keywords and questions per Location, grid size, checks
// per month, and pages a site audit crawls. A missing limit is unlimited (for audits: AUDIT_PAGES, checks/cycle.ts).

import { billingOf, type AppContext } from "@app/kernel";
import type { DeclaredResource } from "@app/kernel";

export const SEO = "seo" as const;
export const FEATURE = "seo" as const;

export const seoPermissions: DeclaredResource = {
  id: SEO,
  label: "SEO",
  group: "seo",
  actions: [
    { id: "view", label: "See rankings, answers, competitors and suggestions", tier: "view" },
    { id: "track", label: "Track keywords, questions and competitors", tier: "edit" },
    { id: "publish", label: "Apply changes and posts to the Google profile", tier: "publish" },
    { id: "manage", label: "Add locations, change checks, link the Google profile", tier: "manage" },
  ],
};

export type SeoAction = "view" | "track" | "publish" | "manage";

/** The Plan's limits, by entitlement key (`limit.<key>`). */
export const limits = {
  locations: "seo_locations",
  keywords: "seo_keywords",
  questions: "seo_questions",
  gridSize: "seo_grid_size",
  checksPerMonth: "seo_checks_per_month",
  auditPages: "seo_audit_pages",
} as const;

export const checkEvery = ["daily", "weekly", "monthly"] as const;
export type CheckEvery = (typeof checkEvery)[number];
export const checksPerMonth: Record<CheckEvery, number> = { daily: 30, weekly: 4, monthly: 1 };

export const gridSizes = [5, 7, 9] as const;

/** Throws plan_limit when adding one more would pass the Plan's limit. */
export async function assertUnderLimit(ctx: AppContext, orgId: string, key: keyof typeof limits, current: number): Promise<void> {
  const billing = billingOf(ctx);
  billing.checkLimit(await billing.entitlementsFor(orgId), limits[key], current);
}

/** Throws plan_limit when a value is above the Plan's ceiling (grid size, checks per month). */
export async function assertWithinCeiling(
  ctx: AppContext,
  orgId: string,
  key: "gridSize" | "checksPerMonth",
  value: number,
): Promise<void> {
  const billing = billingOf(ctx);
  // checkLimit throws when current >= limit; a ceiling allows equal, so ask about one below.
  billing.checkLimit(await billing.entitlementsFor(orgId), limits[key], value - 1);
}

/** What the Plan allows, for the pages that show usage ("12 of 20 keywords"). Null is unlimited. */
export async function planLimits(ctx: AppContext, orgId: string): Promise<Record<keyof typeof limits, number | null>> {
  const ent = await billingOf(ctx).entitlementsFor(orgId);
  const of = (k: string) => {
    const v = ent.get(`limit.${k}`);
    return v === undefined ? null : v;
  };
  return {
    locations: of(limits.locations),
    keywords: of(limits.keywords),
    questions: of(limits.questions),
    gridSize: of(limits.gridSize),
    checksPerMonth: of(limits.checksPerMonth),
    auditPages: of(limits.auditPages),
  };
}

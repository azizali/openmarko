// The SEO overview: where the Location stands this week (one number per check with its change, and the three rows
// that say the most), the results card from its Google profile, and the Plan's usage. The suggestions beside it, and
// what's being checked right now (checks/status.ts), come from their own routes.

import type { AppContext } from "@app/kernel";
import { planLimits } from "../access";
import { getLocationView, getLocation } from "../locations/service";
import { resultsCard } from "../profile/service";
import { openCounts } from "../suggestions/service";
import { aiPage } from "./ai";
import { competitorCounts } from "./competitors";
import { keywordsPage } from "./keywords";
import { lastCheckedAt } from "./latest";
import { mapsSummary } from "./maps";

export async function overview(ctx: AppContext, orgId: string, locationId: string) {
  const l = await getLocation(ctx, orgId, locationId);
  const [location, maps, kw, ai, competitors, open, profile, checked, limits] = await Promise.all([
    getLocationView(ctx, orgId, locationId),
    mapsSummary(ctx, orgId, locationId),
    keywordsPage(ctx, orgId, locationId),
    aiPage(ctx, orgId, locationId),
    competitorCounts(ctx, orgId, locationId),
    openCounts(ctx, locationId),
    resultsCard(ctx, l).catch(() => null),
    lastCheckedAt(ctx.db, locationId),
    planLimits(ctx, orgId),
  ]);
  const ready = maps.keywords.filter((k) => !k.pending);
  const ranked = kw.keywords.filter((k) => !k.pending).sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
  return {
    location,
    lastCheckedAt: checked,
    maps: {
      top3: maps.totals.top3,
      spots: maps.totals.spots,
      top3Before: maps.totals.top3Before,
      keywords: maps.keywords.length,
      rows: ready.slice(0, 3).map((k) => ({ id: k.id, term: k.term, top3: k.top3, spots: k.size * k.size, size: k.size, grid: k.grid })),
    },
    keywords: {
      firstPage: kw.firstPage,
      firstPageBefore: kw.firstPageBefore,
      total: kw.keywords.length,
      rows: ranked.slice(0, 3).map((k) => ({ id: k.id, term: k.term, position: k.position })),
    },
    ai: { named: ai.named, total: ai.total, namedBefore: ai.namedBefore, questions: ai.questions.length, byEngine: ai.byEngine },
    competitors,
    openSuggestions: { maps: open.maps ?? 0, keywords: open.keywords ?? 0, ai: open.ai ?? 0 },
    profile,
    usage: {
      keywords: { used: kw.keywords.length, limit: limits.keywords },
      questions: { used: ai.questions.length, limit: limits.questions },
    },
  };
}

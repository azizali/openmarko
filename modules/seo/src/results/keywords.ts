// The Keywords page (Google search): per keyword its searches a month, your position now and a month ago, what the
// page shows, who's first, and Google's whole first page with directories marked; plus how many keywords are on the
// first page, over the last 90 days.

import { and, eq, gte, sql } from "drizzle-orm";
import type { AppContext } from "@app/kernel";
import { getLocation } from "../locations/service";
import { keywordMetrics, keywords, serpResults } from "../schema";
import { itemsOf, latestSerps } from "./latest";
import { baseline, sum, weekly } from "./series";

export async function keywordsPage(ctx: AppContext, orgId: string, locationId: string) {
  const l = await getLocation(ctx, orgId, locationId);
  const kws = await ctx.db
    .select({ id: keywords.id, term: keywords.term, monthlySearches: keywordMetrics.monthlySearches, trend: keywordMetrics.trend })
    .from(keywords)
    .leftJoin(keywordMetrics, eq(keywordMetrics.id, keywords.metricId))
    .where(and(eq(keywords.locationId, l.id), eq(keywords.active, true)))
    .orderBy(keywords.createdAt);
  const [now, before] = await Promise.all([latestSerps(ctx.db, l.id), latestSerps(ctx.db, l.id, true)]);
  const items = await itemsOf(
    ctx.db,
    now.map((r) => r.id),
  );
  const rows = kws.map((k) => {
    const r = now.find((x) => x.keywordId === k.id);
    const b = before.find((x) => x.keywordId === k.id);
    const page = r
      ? items
          .filter((i) => i.resultId === r.id)
          .map((i) => ({
            position: i.position,
            domain: i.domain,
            url: i.url,
            title: i.title,
            kind: i.itemType as "business" | "directory",
            name: i.placeName,
            isYou: !!l.placeId && i.placeId === l.placeId,
          }))
      : [];
    return {
      id: k.id,
      term: k.term,
      monthlySearches: k.monthlySearches,
      pending: !r,
      position: r?.yourPosition ?? null,
      before: b ? b.yourPosition : undefined,
      url: r?.yourUrl ?? null,
      hasMapPack: r?.hasMapPack ?? false,
      hasAiOverview: r?.hasAiOverview ?? false,
      aiOverviewCitesYou: r?.aiOverviewCitesYou ?? false,
      first: page.find((p) => !p.isYou) ?? null,
      page,
    };
  });
  const onFirstPage = (x: { yourPosition: number | null }) => (x.yourPosition !== null && x.yourPosition <= 10 ? 1 : 0);
  const firstPage = (xs: { yourPosition: number | null }[]) => sum(xs.map(onFirstPage));
  const firstPageThen = baseline(now, before, (r) => r.keywordId, onFirstPage);
  const history = await ctx.db
    .select({ at: serpResults.checkedAt, key: serpResults.keywordId, position: serpResults.yourPosition })
    .from(serpResults)
    .where(
      and(
        eq(serpResults.locationId, l.id),
        gte(serpResults.checkedAt, sql`now() - interval '100 days'`),
        sql`${serpResults.keywordId} in (select id from seo.keywords where location_id = ${l.id} and active)`,
      ),
    );
  return {
    keywords: rows,
    firstPage: firstPage(now),
    firstPageBefore: firstPageThen && sum(firstPageThen),
    history: weekly(
      history.map((h) => ({ at: h.at, key: h.key, value: h.position !== null && h.position <= 10 ? 1 : 0 })),
      sum,
    ),
  };
}

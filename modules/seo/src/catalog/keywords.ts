// Searches a month per keyword: asked of the provider once a month per term, country and language, and shared by
// every Organization that tracks the term (Q3).

import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { newId, type AppContext } from "@app/kernel";
import { invoke, type KeywordMetric } from "@app/integrations";
import { keywordMetrics } from "../schema";
import { normalizeTerm } from "../lib/text";

const FRESH_DAYS = 30;

export type Metric = { id: string; term: string; monthlySearches: number | null; trend: number[] };

/**
 * The metric row for each term, asking the provider only for terms with none fresher than a month. Returns them by
 * term. A provider failure leaves the terms without a volume rather than failing what asked.
 */
export async function metricsFor(
  ctx: AppContext,
  orgId: string,
  terms: string[],
  market: { countryCode: string; languageCode: string },
  runId: string | null = null,
): Promise<Map<string, Metric>> {
  const wanted = [...new Set(terms.map(normalizeTerm).filter(Boolean))];
  if (!wanted.length) return new Map();
  const same = and(
    inArray(keywordMetrics.term, wanted),
    eq(keywordMetrics.countryCode, market.countryCode),
    eq(keywordMetrics.languageCode, market.languageCode),
  );
  const fresh = await ctx.db
    .select()
    .from(keywordMetrics)
    .where(and(same, gt(keywordMetrics.refreshedAt, sql`now() - interval '${sql.raw(String(FRESH_DAYS))} days'`)));
  const have = new Set(fresh.map((m) => m.term));
  const missing = wanted.filter((t) => !have.has(t));
  if (missing.length) {
    const asked = await invoke<{ metrics: KeywordMetric[] }>(
      ctx,
      orgId,
      "search.keywords",
      { op: "volume", terms: missing, countryCode: market.countryCode, languageCode: market.languageCode },
      { runId },
    ).catch(() => null);
    const got = asked?.output.metrics ?? [];
    if (got.length)
      await ctx.db
        .insert(keywordMetrics)
        .values(
          got.map((m) => ({
            id: newId(),
            term: normalizeTerm(m.term),
            countryCode: market.countryCode,
            languageCode: market.languageCode,
            monthlySearches: m.monthlySearches,
            cpc: m.cpc,
            competition: m.competition,
            trend: m.trend,
          })),
        )
        .onConflictDoUpdate({
          target: [keywordMetrics.term, keywordMetrics.countryCode, keywordMetrics.languageCode],
          set: {
            monthlySearches: sql`excluded.monthly_searches`,
            cpc: sql`excluded.cpc`,
            competition: sql`excluded.competition`,
            trend: sql`excluded.trend`,
            refreshedAt: sql`now()`,
          },
        });
  }
  const rows = await ctx.db.select().from(keywordMetrics).where(same);
  return new Map(rows.map((m) => [m.term, { id: m.id, term: m.term, monthlySearches: m.monthlySearches, trend: m.trend }]));
}

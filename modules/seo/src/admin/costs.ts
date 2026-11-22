// SEO costs, for app admins (Q10): what search data really cost per Organization this month (from the checks that
// ran, which carry the provider's own prices), and what each Location will cost a month at its settings (the
// estimate uses the provider's unit prices). Customers never see dollars; they see their Plan's limits.

import { and, eq, gte, ne, sql } from "drizzle-orm";
import { authOrganization, type AppContext } from "@app/kernel";
import { searchUnitPriceUsd, type AiEngine } from "@app/integrations";
import { checksPerMonth, type CheckEvery } from "../access";
import { checks, keywords, locations, questions } from "../schema";

const micros = (usd: number) => Math.round(usd * 1_000_000);

/** A Location's monthly cost at its settings, by check. */
export function estimateMonthly(input: { keywords: number; questions: number; gridSize: number; checkEvery: string; engines: string[] }) {
  const per = checksPerMonth[input.checkEvery as CheckEvery] ?? 4;
  const p = searchUnitPriceUsd;
  const maps = micros(input.keywords * input.gridSize * input.gridSize * p.maps * per);
  const organic = micros(input.keywords * p.organic * per);
  const ai = micros(input.questions * input.engines.reduce((n, e) => n + (p.ai[e as AiEngine] ?? 0), 0) * per);
  // Volumes are refreshed monthly; one request covers up to 1,000 keywords.
  const volumes = input.keywords ? micros(p.volume) : 0;
  return { maps, organic, ai, volumes, total: maps + organic + ai + volumes };
}

export async function costs(ctx: AppContext) {
  const spent = await ctx.db
    .select({
      organizationId: checks.organizationId,
      name: authOrganization.name,
      kind: checks.kind,
      calls: sql<number>`sum(${checks.calls})::int`,
      costMicros: sql<number>`sum(${checks.costMicros})::bigint`,
    })
    .from(checks)
    .innerJoin(authOrganization, eq(authOrganization.id, checks.organizationId))
    .where(gte(checks.queuedAt, sql`date_trunc('month', now())`))
    .groupBy(checks.organizationId, authOrganization.name, checks.kind);

  const locs = await ctx.db
    .select({
      id: locations.id,
      organizationId: locations.organizationId,
      organization: authOrganization.name,
      name: locations.name,
      status: locations.status,
      gridSize: locations.gridSize,
      checkEvery: locations.checkEvery,
      engines: locations.engines,
      keywords: sql<number>`(select count(*)::int from ${keywords} k where k.location_id = "locations"."id" and k.active)`,
      questions: sql<number>`(select count(*)::int from ${questions} q where q.location_id = "locations"."id" and q.active)`,
    })
    .from(locations)
    .innerJoin(authOrganization, eq(authOrganization.id, locations.organizationId))
    .where(and(ne(locations.status, "archived"), ne(locations.status, "draft")));

  const orgs = new Map<
    string,
    { organizationId: string; name: string; calls: number; costMicros: number; byKind: Record<string, number> }
  >();
  for (const r of spent) {
    const o = orgs.get(r.organizationId) ?? { organizationId: r.organizationId, name: r.name, calls: 0, costMicros: 0, byKind: {} };
    o.calls += r.calls;
    o.costMicros += Number(r.costMicros);
    o.byKind[r.kind] = (o.byKind[r.kind] ?? 0) + Number(r.costMicros);
    orgs.set(r.organizationId, o);
  }
  return {
    unitPricesUsd: searchUnitPriceUsd,
    thisMonth: [...orgs.values()].sort((a, b) => b.costMicros - a.costMicros),
    locations: locs.map((l) => ({ ...l, estimate: estimateMonthly(l) })).sort((a, b) => b.estimate.total - a.estimate.total),
  };
}

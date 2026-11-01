import { and, desc, eq } from "drizzle-orm";
import { newId, notFound, type AppContext } from "@openmarko/kernel";
import { invoke } from "@openmarko/integrations";
import { competitors, keywords, rankSnapshots } from "./schema";
import { activeLocation, primaryWebsite } from "./locations";

export async function listKeywords(ctx: AppContext, orgId: string, locationId: string) {
  await activeLocation(ctx, orgId, locationId);
  return ctx.db
    .select()
    .from(keywords)
    .where(and(eq(keywords.organizationId, orgId), eq(keywords.locationId, locationId), eq(keywords.active, true)));
}

export async function addKeyword(ctx: AppContext, orgId: string, locationId: string, term: string): Promise<string> {
  await activeLocation(ctx, orgId, locationId);
  const id = newId();
  const rows = await ctx.db
    .insert(keywords)
    .values({ id, organizationId: orgId, locationId, term: term.trim().toLowerCase() })
    .onConflictDoNothing()
    .returning({ id: keywords.id });
  if (rows.length === 0) {
    const [existing] = await ctx.db
      .select({ id: keywords.id })
      .from(keywords)
      .where(and(eq(keywords.locationId, locationId), eq(keywords.term, term.trim().toLowerCase())));
    return existing!.id;
  }
  return id;
}

export async function addCompetitor(
  ctx: AppContext,
  orgId: string,
  locationId: string,
  name: string,
  domain: string | null,
): Promise<string> {
  await activeLocation(ctx, orgId, locationId);
  const id = newId();
  await ctx.db.insert(competitors).values({ id, organizationId: orgId, locationId, name, domain }).onConflictDoNothing();
  return id;
}

export async function listCompetitors(ctx: AppContext, orgId: string, locationId: string) {
  return ctx.db
    .select()
    .from(competitors)
    .where(and(eq(competitors.organizationId, orgId), eq(competitors.locationId, locationId)));
}

export async function listSnapshots(ctx: AppContext, orgId: string, keywordId: string, limit = 90) {
  return ctx.db
    .select()
    .from(rankSnapshots)
    .where(and(eq(rankSnapshots.organizationId, orgId), eq(rankSnapshots.keywordId, keywordId)))
    .orderBy(desc(rankSnapshots.checkedAt))
    .limit(limit);
}

/**
 * Checks every active keyword for one Location: organic rank for the Organization's primary website, and
 * local-pack rank for the Location's name. Works from the address alone, so no Google Business Profile is needed.
 */
export async function scanRankings(
  ctx: AppContext,
  orgId: string,
  locationId: string,
  runId: string | null = null,
): Promise<{ checked: number }> {
  const loc = await activeLocation(ctx, orgId, locationId);
  const site = await primaryWebsite(ctx, orgId);
  const comps = await listCompetitors(ctx, orgId, locationId);
  const names = [loc.name, ...comps.map((c) => c.name)];
  const kws = await listKeywords(ctx, orgId, locationId);

  for (const kw of kws) {
    let organicRank: number | null = null;
    let topDomain: string | null = null;
    if (site) {
      const organic = await invoke<{ rank: number; domain: string }[]>(
        ctx,
        orgId,
        "serp.read",
        { kind: "organic", keyword: kw.term, domain: site.domain },
        { runId },
      );
      organicRank = organic.output.find((i) => i.domain === site.domain)?.rank ?? null;
      topDomain = organic.output[0]?.domain ?? null;
    }
    const maps = await invoke<{ rank: number; name: string }[]>(
      ctx,
      orgId,
      "serp.read",
      { kind: "maps", keyword: kw.term, names },
      { runId },
    );
    const mapRank = maps.output.find((m) => m.name === loc.name)?.rank ?? null;
    await ctx.db
      .insert(rankSnapshots)
      .values({ id: newId(), organizationId: orgId, keywordId: kw.id, organicRank, mapRank, topDomain, runId });
  }
  return { checked: kws.length };
}

export async function keywordExists(ctx: AppContext, orgId: string, keywordId: string) {
  const [k] = await ctx.db
    .select()
    .from(keywords)
    .where(and(eq(keywords.id, keywordId), eq(keywords.organizationId, orgId)));
  if (!k) throw notFound("Keyword");
  return k;
}

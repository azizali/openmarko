// Setting up SEO for a business, in the steps the onboarding screens follow:
//   find     look the business up on Google by name or website (places.find)
//   create   a draft Location from the one picked (locations/service.ts)
//   ideas    what to track, suggested from the business: services, keywords with their searches a month, questions
//            for the AI assistants, and whether its Google profile can be linked
//   launch   the Location becomes active, its profile is linked when it matches, and the first check runs on the
//            priority queue so the first look arrives in minutes
//   progress what the first check has done so far, for the Launch screen

import { and, eq, sql } from "drizzle-orm";
import { invalid, type AppContext } from "@app/kernel";
import { invoke, type Coordinates, type KeywordIdea, type PlaceCandidate } from "@app/integrations";
import { checks, places, websites } from "../schema";
import { startCycle } from "../checks/cycle";
import { getLocation, setStatus } from "../locations/service";
import { linkLocationProfile, profileConnection } from "../profile/service";
import { normalizeTerm } from "../lib/text";

export async function findBusiness(ctx: AppContext, orgId: string, query: string, near?: Coordinates | null): Promise<PlaceCandidate[]> {
  if (query.trim().length < 2) throw invalid("Type the business's name or website.");
  const out = await invoke<{ places: PlaceCandidate[] }>(ctx, orgId, "places.find", { query: query.trim(), near: near ?? null });
  return out.output.places;
}

export type Ideas = {
  services: string[];
  keywords: { term: string; monthlySearches: number | null; position: number | null }[];
  questions: string[];
  profile: { connected: boolean; linkable: boolean };
};

const plural = (s: string) => (/(s|x|ch|sh)$/.test(s) ? `${s}es` : /[^aeiou]y$/.test(s) ? `${s.slice(0, -1)}ies` : `${s}s`);

/** What to track, suggested from the business. Asking for keyword ideas costs a request or two. */
export async function ideasFor(ctx: AppContext, orgId: string, locationId: string): Promise<Ideas> {
  const l = await getLocation(ctx, orgId, locationId);
  const [site] = l.websiteId ? await ctx.db.select({ domain: websites.domain }).from(websites).where(eq(websites.id, l.websiteId)) : [];
  const [place] = l.placeId ? await ctx.db.select().from(places).where(eq(places.id, l.placeId)) : [];
  const category = (place?.primaryCategory ?? "business").toLowerCase();
  const city = (l.city ?? "").toLowerCase();
  const seeds = [city ? `${category} ${city}` : category, `${category} near me`];
  const asked = await invoke<{ ideas: KeywordIdea[] }>(ctx, orgId, "search.keywords", {
    op: "ideas",
    domain: site?.domain ?? null,
    seeds,
    countryCode: l.countryCode,
    languageCode: l.languageCode,
    limit: 40,
  }).catch(() => null);
  const ideas = [
    ...new Map((asked?.output.ideas ?? []).map((i) => [normalizeTerm(i.term), { ...i, term: normalizeTerm(i.term) }])).values(),
  ];
  // Local searches first: the ones naming the city, or "near me".
  const local = ideas
    .filter((i) => !city || i.term.includes(city) || i.term.includes("near me"))
    .sort((a, b) => (b.monthlySearches ?? 0) - (a.monthlySearches ?? 0))
    .slice(0, 15);

  // Services: what the keywords are about, without the city; else the profile's categories.
  const fromKeywords = local
    .map((i) =>
      i.term
        .replace(city, "")
        .replace(/near me/, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((s) => s && s !== category && s.split(" ").length <= 3);
  const services = l.services.length
    ? l.services
    : [...new Set([...fromKeywords, ...(place?.categories ?? []).map((c) => c.toLowerCase())])].slice(0, 8);

  const where = l.city ?? "town";
  const questions = [
    `Who is the best ${category} in ${where}?`,
    `Which ${plural(category)} in ${where} have the best reviews?`,
    ...services.slice(0, 3).map((s) => `Where can I get ${s} in ${where}?`),
  ];
  const conn = await profileConnection(ctx, orgId);
  return {
    services,
    keywords: local.map((i) => ({ term: i.term, monthlySearches: i.monthlySearches, position: i.position })),
    questions,
    profile: { connected: !!conn, linkable: !!conn && !!l.placeId },
  };
}

/** Starts the Location's checks: active, its profile linked when Google is connected, and the first check now. */
export async function launch(ctx: AppContext, orgId: string, by: string | null, locationId: string): Promise<{ runId: string }> {
  const l = await getLocation(ctx, orgId, locationId);
  if (l.status === "archived") throw invalid("This location was removed.");
  await setStatus(ctx, orgId, by, l.id, "active");
  if (!l.gbpLocationName && (await profileConnection(ctx, orgId))) await linkLocationProfile(ctx, orgId, by, l.id).catch(() => null);
  const { runId } = await startCycle(ctx, orgId, l.id, { queue: "priority", trigger: "manual", by });
  return { runId };
}

export type Progress = {
  finished: boolean;
  checks: { kind: string; status: string; calls: number; received: number }[];
};

/** How far a Run's checks have got: for the Launch screen's progress. */
export async function progressOf(ctx: AppContext, orgId: string, locationId: string, runId: string): Promise<Progress> {
  await getLocation(ctx, orgId, locationId);
  const rows = await ctx.db
    .select({
      kind: checks.kind,
      status: checks.status,
      calls: checks.calls,
      received: sql<number>`(select count(*)::int from seo.provider_tasks t where t.check_id = "checks"."id" and t.status <> 'posted')`,
    })
    .from(checks)
    .where(and(eq(checks.runId, runId), eq(checks.locationId, locationId)));
  return { finished: rows.length > 0 && rows.every((r) => r.status === "done" || r.status === "failed"), checks: rows };
}

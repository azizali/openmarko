// Setting up SEO for a business, in the steps the onboarding screens follow:
//   find     look the business up on Google by name or website (places.find)
//   create   a draft Location from the one picked (locations/service.ts)
//   details  the business's full Google profile (every category, what customers mention, nearby places), so the
//            person can pick the categories and cities to track (places.details)
//   ideas    what to track, suggested from the business: services, keywords with their searches a month, questions
//            for the AI assistants, and whether its Google profile can be linked
//   launch   the Location becomes active, its profile is linked when it matches, and the first check runs on the
//            priority queue so the first look arrives in minutes
//   progress what the first check has done so far, for the Launch screen

import { and, eq, sql } from "drizzle-orm";
import { invalid, type AppContext } from "@app/kernel";
import { invoke, type BusinessDetails, type Coordinates, type KeywordIdea, type PlaceCandidate } from "@app/integrations";
import { automationSchema } from "@app/automation";
import { checks, places, websites } from "../schema";
import { startCycle } from "../checks/cycle";
import { getLocation, setStatus } from "../locations/service";
import { linkLocationProfile, profileConnection } from "../profile/service";
import { normalizeTerm } from "../lib/text";
import { categoryCatalog, exactCategory, matchCategories, relatedCategories } from "../catalog/categories";
import { cityCatalog, matchCities, resolveCity, searchName, type City } from "../catalog/cities";
import { isRelevant, keywordSeeds, mapsTerms, meaningless, organicTerms, questionsFor, withoutPlace } from "./ideas";
import { metricsFor, type Metric } from "../catalog/keywords";
import { regionOfAddress } from "../catalog/regions";

export async function findBusiness(ctx: AppContext, orgId: string, query: string, near?: Coordinates | null): Promise<PlaceCandidate[]> {
  if (query.trim().length < 2) throw invalid("Type the business's name or website.");
  const out = await invoke<{ places: PlaceCandidate[] }>(ctx, orgId, "places.find", { query: query.trim(), near: near ?? null });
  return out.output.places;
}

/** Review topics that praise the people or the price rather than name something the business does ("courteous staff"). */
const praise =
  /\b(staff|team|price|prices|pricing|communication|customer|friendly|professional|courteous|knowledgeable|helpful|attitude|experience|quality|value)\b/i;

export type Details = {
  /** Every category the profile lists, the primary one first: the person picks which to track. */
  categories: string[];
  /** Other Google categories close to the ones it lists (a shared word), from Google's own list: ones to consider adding. */
  related: string[];
  /** Where to track, as Google's places ("Austin, TX"): the business's own city first, then places people search for beside it. */
  cities: string[];
  /** What customers mention in reviews, most mentioned first: ideas for services. */
  topics: string[];
  /** Questions people ask about this kind of business: ideas for the AI assistants. */
  questions: string[];
  /** False when the details provider isn't connected or had nothing: only what Google Places gave is offered. */
  enriched: boolean;
  /** Why the profile or the category list couldn't be read, for the screen to say; null when all is well. */
  problem: string | null;
};

/**
 * The business's full profile, and what to offer from it. Costs one request, so the screen asks once per draft. The
 * categories found are kept on the business, so later suggestions compare against the whole list. Without a
 * details provider the setup still works, from the one category Google Places gave.
 */
export async function detailsFor(ctx: AppContext, orgId: string, locationId: string): Promise<Details> {
  const l = await getLocation(ctx, orgId, locationId);
  const [place] = l.placeId ? await ctx.db.select().from(places).where(eq(places.id, l.placeId)) : [];
  const problems: string[] = [];
  const said = (what: string) => (e: unknown) => {
    problems.push(`${what}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  };
  const found: BusinessDetails | null = place
    ? await invoke<{ details: BusinessDetails | null }>(ctx, orgId, "places.details", {
        placeId: place.googlePlaceId,
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        countryCode: l.countryCode,
        languageCode: l.languageCode,
      })
        .then((r) => r.output.details)
        .catch(said("The Google profile couldn't be read"))
    : null;
  if (place && !problems.length && !found?.categories.length) problems.push("The details provider had no categories for this business.");
  if (place && found?.categories.length)
    await ctx.db
      .update(places)
      .set({ categories: found.categories, primaryCategory: found.primaryCategory ?? place.primaryCategory })
      .where(eq(places.id, place.id));
  const unique = (xs: (string | null | undefined)[]) => [...new Set(xs.map((x) => x?.trim()).filter((x): x is string => !!x))];
  const catalog = await categoryCatalog(ctx, orgId).catch(said("Google's category list couldn't be read"));
  if (!catalog?.length && !problems.some((p) => p.startsWith("Google's category"))) problems.push("Google's category list is empty.");
  // Only Google Business categories: what the profile lists, as the list spells them. Places' own type names
  // ("Service") are a different vocabulary and aren't offered. With no list to check against, the profile's own stand.
  const listed = unique(found?.categories ?? []);
  const categories = (catalog?.length ? unique(listed.map((c) => exactCategory(catalog, c))) : listed).filter((c) => !meaningless(c));
  return {
    categories,
    related: relatedCategories(catalog ?? [], categories),
    cities: await citiesOf(ctx, orgId, l, [l.city, ...(found?.nearby ?? [])], said),
    topics: (found?.topics ?? []).map((x) => x.term).filter((t) => !praise.test(t) && !meaningless(t)),
    questions: found?.questions ?? [],
    enriched: !!found?.categories.length,
    problem: problems.length ? problems.join(" ") : null,
  };
}

/** Google's categories matching what's typed. `ready` is false when the list isn't available: then any text is accepted. */
export async function searchCategories(ctx: AppContext, orgId: string, q: string): Promise<{ categories: string[]; ready: boolean }> {
  const catalog = await categoryCatalog(ctx, orgId).catch(() => []);
  return { categories: matchCategories(catalog, q), ready: catalog.length > 0 };
}

type Place = Awaited<ReturnType<typeof getLocation>>;

/** The business's own region, for choosing between towns of one name: "Texas" for an address in "Austin, TX 78701". */
const regionOf = (l: Place) => regionOfAddress(l.countryCode, l.address);

/**
 * Names from the profile ("Austin", "Zilker") as Google's places ("Austin, TX"). Each is the one in the business's own
 * region when there are several, and one the list doesn't have is left out. Without the list the names stand as they are.
 */
async function citiesOf(ctx: AppContext, orgId: string, l: Place, names: (string | null)[], said: (what: string) => (e: unknown) => null) {
  const wanted = [...new Set(names.map((n) => n?.trim()).filter((n): n is string => !!n))];
  const catalog = await cityCatalog(ctx, orgId, l.countryCode).catch(said("Google's list of places couldn't be read"));
  if (!catalog?.length) return wanted;
  return [...new Set(wanted.map((n) => resolveCity(catalog, n, regionOf(l))?.label).filter((x): x is string => !!x))];
}

/** Google's cities and towns matching what's typed, the business's own region first. `ready` is false when the list isn't available. */
export async function searchCityList(
  ctx: AppContext,
  orgId: string,
  locationId: string,
  q: string,
): Promise<{ cities: string[]; ready: boolean }> {
  const l = await getLocation(ctx, orgId, locationId);
  const catalog: City[] = await cityCatalog(ctx, orgId, l.countryCode).catch(() => []);
  return { cities: matchCities(catalog, q, regionOf(l)).map((c) => c.label), ready: catalog.length > 0 };
}

/** One suggested keyword: its searches a month, and where the business's site ranks for it now (Google search). */
export type Idea = { term: string; monthlySearches: number | null; position: number | null };

/**
 * What to track, in the three ways it's checked, each searched differently: Google Maps (short terms, from every spot
 * of the grid), Google search (with the place, or a full question), and the AI assistants (questions).
 */
export type Ideas = {
  services: string[];
  maps: Idea[];
  organic: Idea[];
  questions: string[];
  profile: { connected: boolean; linkable: boolean };
  /** Why the provider's ideas couldn't be read, for the screen to say; the lists are then built from the picks. */
  problem: string | null;
};

/** What the person chose to track: the categories and the cities, each combined with the other. */
export type Focus = { categories?: string[]; cities?: string[] };

/**
 * What to track, suggested from the business. `focus` is the categories and cities the person picked (or added): each
 * category in each city is a seed, as are its services and the bare category (ideas.ts). Asking for keyword ideas
 * costs a request per seed, so the seeds are capped.
 */
export async function ideasFor(ctx: AppContext, orgId: string, locationId: string, focus: Focus = {}): Promise<Ideas> {
  const l = await getLocation(ctx, orgId, locationId);
  const [site] = l.websiteId ? await ctx.db.select({ domain: websites.domain }).from(websites).where(eq(websites.id, l.websiteId)) : [];
  const [place] = l.placeId ? await ctx.db.select().from(places).where(eq(places.id, l.placeId)) : [];
  const clean = (xs: string[] | undefined) => [...new Set((xs ?? []).map((x) => normalizeTerm(x)).filter(Boolean))];
  // What was asked for, else what was picked at Setup and saved on the Location.
  const categories = clean(focus.categories?.length ? focus.categories : l.categories)
    .filter((c) => !meaningless(c))
    .slice(0, 5);
  // Picked places are labels ("Springfield, IL"); a search says only the name people type ("springfield").
  const cityList = await cityCatalog(ctx, orgId, l.countryCode).catch((): City[] => []);
  const cities = clean((focus.cities?.length ? focus.cities : l.cities).slice(0, 4).map((c) => searchName(cityList, c)));
  if (!categories.length) {
    // None picked: the business's own Google category when the list knows it, else a generic search.
    const catalog = await categoryCatalog(ctx, orgId).catch(() => []);
    const own = [place?.primaryCategory, ...(place?.categories ?? [])].map((c) => (c ? exactCategory(catalog, c) : null)).find(Boolean);
    categories.push((own ?? "business").toLowerCase());
  }
  if (!cities.length && l.city) cities.push(l.city.toLowerCase());
  const city = cities[0] ?? "";
  const picked = { categories, cities, services: l.services.map((x) => normalizeTerm(x)).filter(Boolean) };
  let problem: string | null = null;
  const asked = await invoke<{ ideas: KeywordIdea[] }>(ctx, orgId, "search.keywords", {
    op: "ideas",
    domain: site?.domain ?? null,
    seeds: keywordSeeds(picked),
    countryCode: l.countryCode,
    languageCode: l.languageCode,
    limit: 60,
  }).catch((e: unknown) => {
    problem = `Keyword ideas couldn't be read (${e instanceof Error ? e.message : String(e)}): these are built from your picks.`;
    return null;
  });
  const fromProvider = new Map<string, KeywordIdea>();
  for (const i of asked?.output.ideas ?? []) {
    const term = normalizeTerm(i.term);
    if (term && isRelevant(term, picked)) fromProvider.set(term, { ...i, term });
  }

  // The places to take out of a term to say what it's about: the chosen cities, and the business's own town, state
  // and zip ("exterminator ny" is "exterminator").
  const geo = new Set(
    [...cities, ...(l.address?.split(",").slice(1) ?? [])].flatMap((p) => p.toLowerCase().split(/[^a-z0-9]+/)).filter(Boolean),
  );
  // Services: what the keywords are about without the places; else the profile's categories.
  const fromKeywords = [...fromProvider.keys()]
    .map((t) => withoutPlace(t.replace(/near me/, ""), geo))
    .filter((t) => t && !categories.includes(t) && t.split(" ").length <= 3 && !meaningless(t));
  const services = l.services.length
    ? l.services
    : [...new Set([...fromKeywords, ...(place?.categories ?? []).map((c) => c.toLowerCase())])].filter((s) => !meaningless(s)).slice(0, 8);
  const withServices = {
    ...picked,
    categories: picked.categories.filter((c) => !meaningless(c)),
    services: (picked.services.length ? picked.services : services.map(normalizeTerm)).filter((s) => !meaningless(s)),
  };

  // Each list is built from the picks as well as the provider's ideas, so it's never empty; then every term gets its
  // searches a month (one request for all, shared and kept a month) and the most searched come first.
  const ideaTerms = [...fromProvider.keys()];
  const mapsList = mapsTerms(withServices, ideaTerms, geo);
  const organicList = organicTerms(withServices, ideaTerms);
  const metrics = await metricsFor(ctx, orgId, [...mapsList, ...organicList], l).catch(() => new Map<string, Metric>());
  const rank = (terms: string[], cap: number): Idea[] =>
    terms
      .map((term) => ({
        term,
        monthlySearches: fromProvider.get(term)?.monthlySearches ?? metrics.get(term)?.monthlySearches ?? null,
        position: fromProvider.get(term)?.position ?? null,
      }))
      .sort((a, b) => (b.monthlySearches ?? -1) - (a.monthlySearches ?? -1))
      .slice(0, cap);

  const where = city ? (l.city && city === l.city.toLowerCase() ? l.city : city) : "town";
  const questions = questionsFor(withServices, where);
  const conn = await profileConnection(ctx, orgId);
  return {
    services,
    maps: rank(mapsList, 30),
    organic: rank(organicList, 50),
    questions,
    problem,
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

/** How far a Run's checks have got, and whether it's done (suggestions included): for the Launch screen. */
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
  // Finished when the Run is: that's after the last check is filed and the suggestions are written.
  const [run] = await ctx.db
    .select({ finishedAt: automationSchema.runs.finishedAt })
    .from(automationSchema.runs)
    .where(eq(automationSchema.runs.id, runId));
  return { finished: !!run?.finishedAt, checks: rows };
}

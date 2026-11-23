// What Setup suggests tracking, worked out from what the person picked: the searches to ask the keyword provider about
// (seeds), which of what comes back are about this business, and the questions to put to the AI assistants. Pure
// functions, so the shape of the suggestions can be read and tested without a provider.

import { wordsOf } from "../catalog/categories";

/** What the person picked or the business offers: each one feeds a different kind of search. */
export type Focus = { categories: string[]; cities: string[]; services: string[] };

const plural = (s: string) => (/(s|x|ch|sh)$/.test(s) ? `${s}es` : /[^aeiou]y$/.test(s) ? `${s.slice(0, -1)}ies` : `${s}s`);

/**
 * The searches to ask about, most useful first, so a cap cuts the least useful. Beyond "category city":
 *   - each service in the first city ("mice removal austin"), the long tail customers actually type
 *   - the category and each service on their own ("bee exterminator"): not every search names a place
 *   - "near me" for the main ones
 * A cap of 16 keeps a request's cost in check; every category still gets its first city before any gets a second.
 */
export function keywordSeeds({ categories, cities, services }: Focus, cap = 16): string[] {
  const topServices = services.slice(0, 6);
  const [first, ...others] = cities;
  const seeds = [
    ...categories.map((c) => (first ? `${c} ${first}` : c)),
    ...topServices.map((s) => (first ? `${s} ${first}` : s)),
    ...others.flatMap((city) => categories.map((c) => `${c} ${city}`)),
    ...(first ? categories.map((c) => c) : []),
    ...topServices.slice(0, 3).map((s) => `${s} near me`),
    ...categories.slice(0, 2).map((c) => `${c} near me`),
    ...others.flatMap((city) => topServices.slice(0, 2).map((s) => `${s} ${city}`)),
  ];
  return [...new Set(seeds.map((s) => s.trim()).filter(Boolean))].slice(0, cap);
}

/**
 * Whether a term the provider suggested is about this business: it names a chosen city, says "near me", or shares a
 * meaningful word with a category or service ("mice" with "mice removal"), so searches without a place are kept.
 */
export function isRelevant(term: string, { categories, cities, services }: Focus): boolean {
  if (term.includes("near me") || cities.some((c) => term.includes(c))) return true;
  const about = new Set([...categories, ...services].flatMap(wordsOf));
  return term.split(/[^a-z0-9]+/).some((w) => about.has(w));
}

/** Questions people put to an AI assistant about this kind of business, in the main city (and, for the first, the others). */
export function questionsFor({ categories, cities, services }: Focus, where: string): string[] {
  const [category, ...moreCategories] = categories;
  if (!category) return [];
  const places = cities.length > 1 ? cities.slice(0, 3) : [where];
  return [
    ...new Set([
      `Who is the best ${category} in ${where}?`,
      `Which ${plural(category)} in ${where} have the best reviews?`,
      ...services.slice(0, 5).map((s) => `Where can I get ${s} in ${where}?`),
      ...services.slice(0, 3).map((s) => `How much does ${s} cost in ${where}?`),
      `Who is the most affordable ${category} in ${where}?`,
      ...moreCategories.slice(0, 2).map((c) => `Who is the best ${c} in ${where}?`),
      ...places.slice(1).map((p) => `Who is the best ${category} in ${p}?`),
      `Who offers ${services[0] ?? category} near me?`,
    ]),
  ];
}

/** A term with the places in it taken out: "exterminator austin tx" is "exterminator". */
export function withoutPlace(term: string, geo: Set<string>): string {
  return term
    .split(" ")
    .filter((w) => w && !geo.has(w))
    .join(" ")
    .trim();
}

/**
 * What to search on Google Maps. Maps already knows where the searcher stands (each spot of the grid), so people type
 * what they want, not where: "exterminator", "mice removal", "pest control near me". From the categories, the services,
 * and the provider's ideas with the places taken out; short (up to four words), as people type on a map.
 */
export function mapsTerms({ categories, services }: Focus, ideas: string[], geo: Set<string>): string[] {
  const own = [...categories, ...services];
  const fromIdeas = ideas.map((t) => withoutPlace(t, geo)).filter((t) => t && t.split(" ").length <= 4 && !/^(near me|in|best)$/.test(t));
  return [...new Set([...own, ...own.slice(0, 4).map((x) => `${x} near me`), ...fromIdeas])];
}

/**
 * What to search on Google: here people name the place ("pest control round rock") or ask in full ("how to get rid of
 * mice in walls"). Every category and service in every city, "best … in …", and the provider's ideas about the business.
 */
export function organicTerms({ categories, cities, services }: Focus, ideas: string[]): string[] {
  const own = [...categories, ...services.slice(0, 6)];
  return [
    ...new Set([
      ...cities.flatMap((city) => own.map((x) => `${x} ${city}`)),
      ...cities.slice(0, 2).flatMap((city) => categories.slice(0, 2).map((c) => `best ${c} in ${city}`)),
      ...ideas,
    ]),
  ];
}

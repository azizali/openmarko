// Google's list of business categories, kept in our database so Setup can offer and check them without a request each
// time. Fetched through `places.details` (the "categories" op, free) and refreshed monthly. Without a details provider
// the list stays empty and categories are free text, as before.

import { desc, sql } from "drizzle-orm";
import type { AppContext } from "@app/kernel";
import { invoke } from "@app/integrations";
import { placeCategories } from "../schema";
import { refreshStale } from "./fresh";
import { rankMatches } from "./match";

/** Words that say little about what a business does: "Pest control service" and "Termite control service" share "control". */
const generic = new Set(["service", "services", "store", "shop", "company", "provider", "agency", "center", "centre", "and", "the"]);
export const wordsOf = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !generic.has(w));

/** Entries in Google's list that name no kind of business ("Store", "Services"): never offered, never accepted. */
const catchAll = new Set([
  "store",
  "company",
  "establishment",
  "business",
  "organization",
  "service",
  "services",
  "services companies",
  "services for industry",
]);

/** Every category, most listed first, fetching the list first when it's missing or a month old. */
export async function categoryCatalog(ctx: AppContext, orgId: string): Promise<string[]> {
  const [row] = await ctx.db
    .select({ n: sql<number>`count(*)::int`, newest: sql<Date | null>`max(${placeCategories.fetchedAt})` })
    .from(placeCategories);
  await refreshStale(
    { n: row?.n ?? 0, newest: row?.newest ?? null },
    async () => {
      const asked = await invoke<{ categories: { name: string; businesses: number }[] }>(ctx, orgId, "places.details", {
        op: "categories",
      });
      const unique = new Map(asked.output.categories.map((c) => [c.name.trim(), c.businesses]));
      return [...unique].filter(([name]) => name).map(([name, businesses]) => ({ name, businesses }));
    },
    (rows) =>
      ctx.db.transaction(async (tx) => {
        await tx.delete(placeCategories);
        for (let i = 0; i < rows.length; i += 1000) await tx.insert(placeCategories).values(rows.slice(i, i + 1000));
      }),
  );
  const all = await ctx.db.select({ name: placeCategories.name }).from(placeCategories).orderBy(desc(placeCategories.businesses));
  return all.map((r) => r.name).filter((n) => !catchAll.has(n.toLowerCase()));
}

/** Categories matching what's typed: names starting with it first, then ones containing every word of it, most listed first. */
export const matchCategories = (catalog: string[], q: string, limit = 10) => rankMatches(catalog, q, (c) => c, { limit });

/** The catalog's name for what was typed, when it is one (any case): the only way a category is accepted. */
export const exactCategory = (catalog: string[], typed: string) =>
  catalog.find((c) => c.toLowerCase() === typed.trim().toLowerCase()) ?? null;

/** Categories that share a meaningful word with the ones the business has, most in common first. */
export function relatedCategories(catalog: string[], have: string[], limit = 8): string[] {
  const owned = new Set(have.map((h) => h.toLowerCase()));
  const mine = new Set(have.flatMap(wordsOf));
  return catalog
    .filter((c) => !owned.has(c.toLowerCase()))
    .map((c) => ({ c, shared: wordsOf(c).filter((w) => mine.has(w)).length }))
    .filter((x) => x.shared > 0)
    .sort((a, b) => b.shared - a.shared || a.c.length - b.c.length)
    .slice(0, limit)
    .map((x) => x.c);
}

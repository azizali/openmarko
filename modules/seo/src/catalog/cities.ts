// The places a business can be tracked in, from Google's own list: so "Springfield" is "Springfield, IL" or
// "Springfield, MO", never a word that could mean either. Fetched through `places.details` (the "locations" op, free)
// per country and refreshed monthly. Only cities and towns are kept (not counties, states or postcodes); the one a
// person picks is saved as its label, which names exactly one place. Without a details provider the list stays empty
// and a city is free text, as before.

import { eq, sql } from "drizzle-orm";
import type { AppContext } from "@app/kernel";
import { invoke, type PlaceLocation } from "@app/integrations";
import { placeCities } from "../schema";
import { refreshStale } from "./fresh";
import { rankMatches } from "./match";
import { regionLabel } from "./regions";

export type City = typeof placeCities.$inferSelect;
type Row = typeof placeCities.$inferInsert;

/** Kinds of place Google lists that a customer would call a city or a town (it files towns under several names). */
const wanted = new Set(["City", "Municipality", "Borough", "Town", "Village", "Neighborhood"]);

/** "Hyde Park,Austin,Texas,United States" → label "Hyde Park, Austin, TX", city "Hyde Park", region "Texas". */
export function toRow(countryCode: string, l: PlaceLocation): Row | null {
  if (!wanted.has(l.type)) return null;
  const path = l.name.split(",").map((p) => p.trim());
  path.pop(); // the country
  if (!path[0]) return null;
  const region = path.length > 1 ? path.at(-1)! : null;
  const label = [...path.slice(0, -1), ...(region ? [regionLabel(countryCode, region)] : [])].join(", ");
  return { code: l.code, countryCode, label, city: path[0], region, type: l.type };
}

/** Rows for a country's places; two places that would show the same label are told apart by their kind, then their code. */
export function rowsFor(countryCode: string, locations: PlaceLocation[]): Row[] {
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const l of locations) {
    const row = toRow(countryCode, l);
    if (!row) continue;
    for (const label of [row.label, `${row.label} (${row.type})`, `${row.label} (${row.type} ${row.code})`]) {
      if (seen.has(label)) continue;
      seen.add(label);
      rows.push({ ...row, label });
      break;
    }
  }
  return rows;
}

/** A country's cities and towns, fetching the list first when it's missing or a month old. */
export async function cityCatalog(ctx: AppContext, orgId: string, countryCode: string): Promise<City[]> {
  const where = eq(placeCities.countryCode, countryCode);
  const [row] = await ctx.db
    .select({ n: sql<number>`count(*)::int`, newest: sql<Date | null>`max(${placeCities.fetchedAt})` })
    .from(placeCities)
    .where(where);
  await refreshStale(
    { n: row?.n ?? 0, newest: row?.newest ?? null },
    async () => {
      const asked = await invoke<{ locations: PlaceLocation[] }>(ctx, orgId, "places.details", { op: "locations", countryCode });
      return rowsFor(countryCode, asked.output.locations);
    },
    (rows) =>
      ctx.db.transaction(async (tx) => {
        await tx.delete(placeCities).where(where);
        for (let i = 0; i < rows.length; i += 1000) await tx.insert(placeCities).values(rows.slice(i, i + 1000));
      }),
  );
  return ctx.db.select().from(placeCities).where(where);
}

/**
 * Places matching what's typed ("spring il"), those that start with it first, then those in the business's own region
 * (`near`, a full region name), then cities before neighbourhoods.
 */
export const matchCities = (catalog: City[], q: string, near: string | null, limit = 10) =>
  rankMatches(catalog, q, (c) => c.label, {
    limit,
    boost: (c) => Number(!!near && c.region === near) + (c.type === "City" ? 0.5 : 0),
  });

/** The place whose label is what was typed (any case): the only way a city is accepted. */
export const exactCity = (catalog: City[], typed: string) =>
  catalog.find((c) => c.label.toLowerCase() === typed.trim().toLowerCase()) ?? null;

/**
 * The place a bare name means ("Austin", as the business's profile writes it): the one in the business's own region
 * when there are several of that name, cities before neighbourhoods. Null when the list has no such place.
 */
export function resolveCity(catalog: City[], name: string, near: string | null): City | null {
  const n = name.trim().toLowerCase();
  const same = catalog.filter((c) => c.city.toLowerCase() === n);
  const rank = (c: City) => Number(c.region === near) * 2 + Number(c.type === "City");
  return same.sort((a, b) => rank(b) - rank(a))[0] ?? null;
}

/** What people type in a search for a picked place: "Springfield, IL" is "springfield". Text the list doesn't have is kept as is. */
export const searchName = (catalog: City[], picked: string) => exactCity(catalog, picked)?.city ?? picked.split(",")[0]!.trim();

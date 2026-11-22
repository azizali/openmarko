// What every kind of filing shares: the check being filed, and how the Location's own business is recognised in
// results (by its place, else by its website's domain, else by its exact name).

import { eq, inArray } from "drizzle-orm";
import type { Tx } from "@app/kernel";
import type { PlaceFacts } from "../catalog/places";
import type { LocationRow } from "../locations/service";
import { locations, places, websites } from "../schema";

export type Filing = { checkId: string; location: LocationRow; checkedAt: Date };

/** The Location's website domain, or null. */
export async function domainOfLocation(tx: Tx, l: LocationRow): Promise<string | null> {
  if (!l.websiteId) return null;
  const [w] = await tx.select({ domain: websites.domain }).from(websites).where(eq(websites.id, l.websiteId));
  return w?.domain ?? null;
}

/**
 * The place id that is the Location's own business among these results. When the Location had no place yet and one
 * is recognised, it's remembered on the Location.
 */
export async function whoIsYou(tx: Tx, l: LocationRow, facts: PlaceFacts[], ids: Map<string, string>): Promise<string | null> {
  if (l.placeId) return l.placeId;
  const domain = await domainOfLocation(tx, l);
  const name = l.name.trim().toLowerCase();
  const hit = facts.find((f) => (domain && f.domain === domain) || f.name.trim().toLowerCase() === name);
  const id = hit ? (ids.get(hit.key) ?? null) : null;
  if (id) {
    await tx.update(locations).set({ placeId: id }).where(eq(locations.id, l.id));
    l.placeId = id;
  }
  return id;
}

/** Place ids by domain, for results that list websites rather than businesses. */
export async function placesByDomain(tx: Tx, domains: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(domains.filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = await tx.select({ id: places.id, domain: places.domain }).from(places).where(inArray(places.domain, unique));
  return new Map(rows.map((r) => [r.domain!, r.id]));
}

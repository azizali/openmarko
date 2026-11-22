// The public catalog's businesses: every business seen in a result or looked up lands here once, keyed by Google's
// place id. Its rating and reviews are kept as one snapshot a day. Shared by every Organization (Q3).

import { sql } from "drizzle-orm";
import { newId, type Db, type Tx } from "@app/kernel";
import { domainOf, type MapsItem, type PlaceCandidate } from "@app/integrations";
import { placeSnapshots, places } from "../schema";

/** What we know about a business from one source. `key` is Google's place id, or `cid:<cid>` when only that came. */
export type PlaceFacts = {
  key: string;
  cid: string | null;
  name: string;
  primaryCategory: string | null;
  categories: string[];
  address: string | null;
  lat: number | null;
  lng: number | null;
  domain: string | null;
  phone: string | null;
  rating: number | null;
  reviewCount: number | null;
  isClaimed: boolean | null;
};

export function factsFromMaps(i: MapsItem): PlaceFacts | null {
  const key = i.placeId ?? (i.cid ? `cid:${i.cid}` : null);
  if (!key) return null;
  return {
    key,
    cid: i.cid,
    name: i.name,
    primaryCategory: i.category,
    categories: i.categories,
    address: i.address,
    lat: i.lat,
    lng: i.lng,
    domain: i.domain,
    phone: i.phone,
    rating: i.rating,
    reviewCount: i.reviewCount,
    isClaimed: i.isClaimed,
  };
}

export function factsFromCandidate(p: PlaceCandidate): PlaceFacts {
  return {
    key: p.placeId,
    cid: null,
    name: p.name,
    primaryCategory: p.category,
    categories: p.category ? [p.category] : [],
    address: p.address,
    lat: p.lat,
    lng: p.lng,
    domain: domainOf(p.website),
    phone: p.phone,
    rating: p.rating,
    reviewCount: p.reviewCount,
    isClaimed: null,
  };
}

/**
 * Adds or refreshes businesses and today's snapshot of their numbers. Returns each one's id by its key. A value a
 * source didn't give (null) never erases one we had.
 */
export async function upsertPlaces(
  db: Db | Tx,
  facts: PlaceFacts[],
  source: "maps" | "business_data" | "gbp" | "lookup",
): Promise<Map<string, string>> {
  const unique = [...new Map(facts.map((f) => [f.key, f])).values()];
  if (!unique.length) return new Map();
  const rows = await db
    .insert(places)
    .values(
      unique.map((f) => ({
        id: newId(),
        googlePlaceId: f.key,
        cid: f.cid,
        name: f.name,
        primaryCategory: f.primaryCategory,
        categories: f.categories,
        address: f.address,
        lat: f.lat,
        lng: f.lng,
        domain: f.domain,
        phone: f.phone,
      })),
    )
    .onConflictDoUpdate({
      target: places.googlePlaceId,
      set: {
        name: sql`excluded.name`,
        cid: sql`coalesce(excluded.cid, ${places.cid})`,
        primaryCategory: sql`coalesce(excluded.primary_category, ${places.primaryCategory})`,
        categories: sql`case when cardinality(excluded.categories) > 0 then excluded.categories else ${places.categories} end`,
        address: sql`coalesce(excluded.address, ${places.address})`,
        lat: sql`coalesce(excluded.lat, ${places.lat})`,
        lng: sql`coalesce(excluded.lng, ${places.lng})`,
        domain: sql`coalesce(excluded.domain, ${places.domain})`,
        phone: sql`coalesce(excluded.phone, ${places.phone})`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: places.id, key: places.googlePlaceId });
  const ids = new Map(rows.map((r) => [r.key, r.id]));

  const snapshots = unique
    .filter((f) => f.rating !== null || f.reviewCount !== null)
    .map((f) => ({
      placeId: ids.get(f.key)!,
      observedOn: today(),
      rating: f.rating,
      reviewCount: f.reviewCount,
      isClaimed: f.isClaimed,
      source: source === "lookup" ? "maps" : source,
    }));
  if (snapshots.length)
    await db
      .insert(placeSnapshots)
      .values(snapshots)
      .onConflictDoUpdate({
        target: [placeSnapshots.placeId, placeSnapshots.observedOn],
        set: {
          rating: sql`coalesce(excluded.rating, ${placeSnapshots.rating})`,
          reviewCount: sql`coalesce(excluded.review_count, ${placeSnapshots.reviewCount})`,
          isClaimed: sql`coalesce(excluded.is_claimed, ${placeSnapshots.isClaimed})`,
        },
      });
  return ids;
}

/** Today in UTC, as a date column takes it. */
export const today = () => new Date().toISOString().slice(0, 10);

/** A business's public numbers now, and how many reviews it gained over about the last 30 days. */
export type PlaceNumbers = {
  rating: number | null;
  reviewCount: number | null;
  newReviewsPerMonth: number | null;
  isClaimed: boolean | null;
};

export async function numbersOf(db: Db, placeIds: string[]): Promise<Map<string, PlaceNumbers>> {
  if (!placeIds.length) return new Map();
  const rows = await db.execute<{
    place_id: string;
    rating: number | null;
    review_count: number | null;
    is_claimed: boolean | null;
    month_ago: number | null;
  }>(sql`
    select distinct on (s.place_id) s.place_id, s.rating, s.review_count, s.is_claimed,
      (select o.review_count from seo.place_snapshots o
        where o.place_id = s.place_id and o.observed_on <= s.observed_on - 21 and o.review_count is not null
        order by o.observed_on desc limit 1) as month_ago
    from seo.place_snapshots s
    where s.place_id in (${sql.join(
      placeIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})
    order by s.place_id, s.observed_on desc`);
  return new Map(
    rows.rows.map((r) => [
      r.place_id,
      {
        rating: r.rating,
        reviewCount: r.review_count,
        isClaimed: r.is_claimed,
        newReviewsPerMonth: r.review_count !== null && r.month_ago !== null ? Math.max(0, r.review_count - r.month_ago) : null,
      },
    ]),
  );
}

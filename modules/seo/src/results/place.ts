// One business up close, for the drawer that opens from a Google Maps leaderboard: its profile (categories, website,
// phone, claimed), how its rating and reviews moved over the last 90 days and when new reviews came in, and where it
// stands on each of the Location's Maps keywords beside you. Everything is from the shared catalog and the
// Location's own scans; nothing here calls a provider.

import { and, eq, gte, sql } from "drizzle-orm";
import { notFound, type AppContext } from "@app/kernel";
import { numbersOf } from "../catalog/places";
import { getLocation } from "../locations/service";
import { placeSnapshots, places } from "../schema";
import { activeKeywords, latestScans, standingsOf } from "./latest";
import { milesBetween } from "./maps";
import { weekly } from "./series";

/** A link that opens the business on Google Maps, from Google's place id or, when that's all we have, its cid. */
const mapsUrl = (key: string) =>
  key.startsWith("cid:")
    ? `https://maps.google.com/?cid=${encodeURIComponent(key.slice(4))}`
    : `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(key)}`;

/** A snapshot's day as a time, midday UTC so it lands in the right week. */
const at = (on: string) => new Date(`${on}T12:00:00Z`);

export async function placeInsight(ctx: AppContext, orgId: string, locationId: string, placeId: string) {
  const l = await getLocation(ctx, orgId, locationId);
  const [p] = await ctx.db.select().from(places).where(eq(places.id, placeId));
  if (!p) throw notFound("Business");

  const [numbers, snaps, kws, scans, mine] = await Promise.all([
    numbersOf(ctx.db, [p.id]),
    ctx.db
      .select({ on: placeSnapshots.observedOn, rating: placeSnapshots.rating, reviews: placeSnapshots.reviewCount })
      .from(placeSnapshots)
      .where(and(eq(placeSnapshots.placeId, p.id), gte(placeSnapshots.observedOn, sql`current_date - 100`)))
      .orderBy(placeSnapshots.observedOn),
    activeKeywords(ctx.db, l.id, "maps"),
    latestScans(ctx.db, l.id),
    l.placeId ? ctx.db.select({ categories: places.categories }).from(places).where(eq(places.id, l.placeId)) : Promise.resolve([]),
  ]);
  const n = numbers.get(p.id);

  // Reviews: the count each week, and the new ones each week (the rise from the week before; null until there are two).
  const reviewCount = weekly(
    snaps.filter((s) => s.reviews !== null).map((s) => ({ at: at(s.on), key: "r", value: s.reviews! })),
    (xs) => xs[0]!,
  );
  const rating = weekly(
    snaps.filter((s) => s.rating !== null).map((s) => ({ at: at(s.on), key: "r", value: s.rating! })),
    (xs) => xs[0]!,
  );
  const newPerWeek = reviewCount.values.map((v, i) => {
    const prev = reviewCount.values[i - 1];
    return v === null || prev === null || prev === undefined ? null : Math.max(0, v - prev);
  });
  const tracked = snaps.find((s) => s.reviews !== null);

  // Where it stands on each Maps keyword, from the newest scan, with you beside it.
  const latest = scans.filter((s) => kws.some((k) => k.id === s.keywordId));
  const standings = await standingsOf(
    ctx.db,
    latest.map((s) => s.id),
  );
  const keywords = kws
    .map((k) => {
      const scan = latest.find((s) => s.keywordId === k.id);
      if (!scan) return null;
      const here = standings
        .filter((s) => s.scanId === scan.id)
        .toSorted((a, b) => b.top3Spots - a.top3Spots || a.avgPosition - b.avgPosition);
      const i = here.findIndex((s) => s.placeId === p.id);
      return {
        keywordId: k.id,
        term: k.term,
        spots: scan.gridSize * scan.gridSize,
        rank: i < 0 ? null : i + 1,
        top3: i < 0 ? 0 : here[i]!.top3Spots,
        yourTop3: scan.yourTop3Spots,
      };
    })
    .filter((k): k is NonNullable<typeof k> => k !== null)
    .toSorted((a, b) => b.top3 - b.yourTop3 - (a.top3 - a.yourTop3));

  return {
    id: p.id,
    isYou: p.id === l.placeId,
    name: p.name,
    category: p.primaryCategory,
    categories: p.categories,
    /** Your own categories, so the page can show which of theirs you don't list. */
    yourCategories: mine[0]?.categories ?? [],
    address: p.address,
    website: p.domain,
    phone: p.phone,
    mapsUrl: mapsUrl(p.googlePlaceId),
    distanceMi: milesBetween(l, p),
    firstSeenAt: p.firstSeenAt,
    rating: n?.rating ?? null,
    reviews: n?.reviewCount ?? null,
    newReviewsPerMonth: n?.newReviewsPerMonth ?? null,
    isClaimed: n?.isClaimed ?? null,
    trackedSince: tracked?.on ?? null,
    history: { labels: reviewCount.labels, reviews: reviewCount.values, newReviews: newPerWeek, rating: rating.values },
    keywords,
  };
}

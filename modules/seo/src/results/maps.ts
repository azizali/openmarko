// The Google Maps ranking page: for every keyword its newest grid, spots in the top 3, average and who leads; and for
// one keyword the whole grid now and a month ago, every business's standing with its Google profile numbers, and
// the last 90 days against the leader. Grids are sent as the order at each spot, so the page can draw anyone's map.

import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { notFound, type AppContext } from "@app/kernel";
import { numbersOf } from "../catalog/places";
import { getLocation } from "../locations/service";
import { keywords, mapPoints, mapScans, mapStandings, places } from "../schema";
import { activeKeywords, latestScans, standingsOf, type ScanRow } from "./latest";
import { baseline, mean, sum, weekly } from "./series";

export async function mapsSummary(ctx: AppContext, orgId: string, locationId: string) {
  const l = await getLocation(ctx, orgId, locationId);
  const [kws, now, before] = await Promise.all([
    activeKeywords(ctx.db, l.id, "maps"),
    latestScans(ctx.db, l.id),
    latestScans(ctx.db, l.id, true),
  ]);
  const standings = await standingsOf(
    ctx.db,
    now.map((s) => s.id),
  );
  const points = now.length
    ? await ctx.db
        .select({ scanId: mapPoints.scanId, idx: mapPoints.idx, yourRank: mapPoints.yourRank })
        .from(mapPoints)
        .where(
          inArray(
            mapPoints.scanId,
            now.map((s) => s.id),
          ),
        )
    : [];
  const rows = kws.map((k) => {
    const scan = now.find((s) => s.keywordId === k.id);
    if (!scan) return { id: k.id, term: k.term, pending: true as const };
    const others = standings.filter((s) => s.scanId === scan.id && s.placeId !== l.placeId).sort((a, b) => b.top3Spots - a.top3Spots);
    const leader =
      others[0] && others[0].top3Spots > scan.yourTop3Spots
        ? { placeId: others[0].placeId, name: others[0].name, top3: others[0].top3Spots }
        : null;
    const grid = Array.from<number | null>({ length: scan.gridSize * scan.gridSize }).fill(null);
    for (const p of points) if (p.scanId === scan.id) grid[p.idx] = p.yourRank;
    return {
      id: k.id,
      term: k.term,
      pending: false as const,
      size: scan.gridSize,
      top3: scan.yourTop3Spots,
      avg: scan.yourAvgPosition,
      door: scan.yourDoorPosition,
      leader,
      grid,
      checkedAt: scan.checkedAt,
    };
  });
  const spots = (s: ScanRow[]) => sum(s.map((x) => x.gridSize * x.gridSize));
  const top3Then = baseline(
    now,
    before,
    (s) => s.keywordId,
    (s) => s.yourTop3Spots,
  );
  const avgThen = baseline(
    now,
    before,
    (s) => s.keywordId,
    (s) => s.yourAvgPosition,
  );
  return {
    keywords: rows,
    totals: {
      top3: sum(now.map((s) => s.yourTop3Spots)),
      spots: spots(now),
      top3Before: top3Then && sum(top3Then),
      avg: now.length ? mean(now.map((s) => s.yourAvgPosition)) : null,
      avgBefore: avgThen && mean(avgThen),
      leading: rows.filter((r) => !r.pending && !r.leader).length,
    },
  };
}

async function gridOf(ctx: AppContext, scan: ScanRow | undefined) {
  if (!scan) return null;
  const pts = await ctx.db
    .select({ idx: mapPoints.idx, lat: mapPoints.lat, lng: mapPoints.lng, ranking: mapPoints.ranking })
    .from(mapPoints)
    .where(eq(mapPoints.scanId, scan.id))
    .orderBy(mapPoints.idx);
  return { checkedAt: scan.checkedAt, size: scan.gridSize, radiusM: scan.radiusM, points: pts };
}

/** Straight-line miles between two points, to one decimal (69 miles to a degree of latitude). */
export const milesBetween = (a: { lat: number; lng: number }, b: { lat: number | null; lng: number | null }) => {
  if (b.lat === null || b.lng === null) return null;
  const dLat = (a.lat - b.lat) * 69;
  const dLng = (a.lng - b.lng) * 69 * Math.cos((a.lat * Math.PI) / 180);
  return Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 10) / 10;
};

export async function mapsKeyword(ctx: AppContext, orgId: string, locationId: string, keywordId: string) {
  const l = await getLocation(ctx, orgId, locationId);
  const [k] = await ctx.db
    .select({ id: keywords.id, term: keywords.term })
    .from(keywords)
    .where(and(eq(keywords.id, keywordId), eq(keywords.locationId, l.id)));
  if (!k) throw notFound("Keyword");
  const scans = await ctx.db
    .select()
    .from(mapScans)
    .where(and(eq(mapScans.keywordId, k.id), gte(mapScans.checkedAt, sql`now() - interval '100 days'`)))
    .orderBy(mapScans.checkedAt);
  const latest = scans[scans.length - 1];
  const monthAgo = [...scans].reverse().find((s) => latest && latest.checkedAt.getTime() - s.checkedAt.getTime() >= 28 * 86_400_000);
  const [scan, before] = await Promise.all([gridOf(ctx, latest), gridOf(ctx, monthAgo)]);

  const standings = latest ? await standingsOf(ctx.db, [latest.id]) : [];
  const ids = [
    ...new Set([...standings.map((s) => s.placeId), ...[scan, before].flatMap((g) => g?.points.flatMap((p) => p.ranking) ?? [])]),
  ];
  const named = ids.length
    ? await ctx.db
        .select({ id: places.id, name: places.name, lat: places.lat, lng: places.lng })
        .from(places)
        .where(inArray(places.id, ids))
    : [];
  const numbers = await numbersOf(
    ctx.db,
    standings.map((s) => s.placeId),
  );
  const board = standings
    .map((s) => {
      const n = numbers.get(s.placeId);
      const p = named.find((x) => x.id === s.placeId);
      return {
        placeId: s.placeId,
        name: s.name,
        isYou: s.placeId === l.placeId,
        top3: s.top3Spots,
        avg: s.avgPosition,
        door: s.doorPosition,
        bestSide: s.bestSide,
        worstSide: s.worstSide,
        distanceMi: p ? milesBetween(l, p) : null,
        rating: n?.rating ?? null,
        reviews: n?.reviewCount ?? null,
        newReviewsPerMonth: n?.newReviewsPerMonth ?? null,
        category: s.primaryCategory,
        categories: s.categories.length,
        website: s.domain,
        isClaimed: n?.isClaimed ?? null,
      };
    })
    .sort((a, b) => b.top3 - a.top3 || a.avg - b.avg)
    .map((b, i) => ({ ...b, rank: i + 1 }));

  const leader = board.find((b) => !b.isYou);
  const series = scans.length
    ? await ctx.db
        .select({ scanId: mapStandings.scanId, placeId: mapStandings.placeId, top3: mapStandings.top3Spots })
        .from(mapStandings)
        .where(
          and(
            inArray(
              mapStandings.scanId,
              scans.map((s) => s.id),
            ),
            inArray(
              mapStandings.placeId,
              [l.placeId, leader?.placeId].filter((x): x is string => !!x),
            ),
          ),
        )
    : [];
  const at = (scanId: string) => scans.find((s) => s.id === scanId)!.checkedAt;
  const you = weekly(
    scans.map((s) => ({ at: s.checkedAt, key: "you", value: s.yourTop3Spots })),
    sum,
  );
  const them = leader
    ? weekly(
        series.filter((r) => r.placeId === leader.placeId).map((r) => ({ at: at(r.scanId), key: "x", value: r.top3 })),
        sum,
      )
    : null;
  return {
    keyword: k,
    scan,
    before,
    places: Object.fromEntries(named.map((p) => [p.id, { name: p.name, isYou: p.id === l.placeId }])),
    youPlaceId: l.placeId,
    board,
    history: { labels: you.labels, you: you.values, leader: leader && them ? { name: leader.name, values: them.values } : null },
  };
}

// Files a Maps check: per keyword, one scan with your summary, one row per spot with the whole order there, and one
// standing per business (spots in the top 3, average, door, best and worst side). Every business seen joins the
// catalog with today's rating and reviews: competitors' profile numbers come free with the results (Q12).

import { newId, type Tx } from "@app/kernel";
import type { MapsResult } from "@app/integrations";
import { factsFromMaps, upsertPlaces, type PlaceFacts } from "../catalog/places";
import { standingOf, standingsOf, type Standing } from "../lib/grid";
import { mapPoints, mapScans, mapStandings } from "../schema";
import type { TaskTarget } from "./cycle";
import { whoIsYou, type Filing } from "./filing";

type MapsTask = { target: Extract<TaskTarget, { kind: "maps" }>; result: MapsResult | null };

export async function fileMaps(tx: Tx, f: Filing, tasks: MapsTask[]): Promise<void> {
  const facts: PlaceFacts[] = tasks.flatMap((t) => (t.result?.items ?? []).map(factsFromMaps).filter((x): x is PlaceFacts => !!x));
  const ids = await upsertPlaces(tx, facts, "maps");
  const you = await whoIsYou(tx, f.location, facts, ids);

  const byKeyword = new Map<string, MapsTask[]>();
  for (const t of tasks) byKeyword.set(t.target.keywordId, [...(byKeyword.get(t.target.keywordId) ?? []), t]);

  for (const [keywordId, list] of byKeyword) {
    const first = list[0]!.target;
    const size = first.size;
    // The order at each spot, as place ids. A spot whose search failed counts as empty.
    const rankings: string[][] = Array.from({ length: size * size }, () => []);
    const where = new Map<number, { lat: number; lng: number }>();
    for (const t of list) {
      where.set(t.target.idx, t.target.query.at);
      rankings[t.target.idx] = (t.result?.items ?? [])
        .map((i) => factsFromMaps(i))
        .map((x) => (x ? ids.get(x.key) : undefined))
        .filter((x): x is string => !!x);
    }
    const standings = standingsOf(size, rankings);
    const mine: Standing =
      (you && standings.get(you)) ||
      standingOf(
        size,
        rankings.map(() => null),
      );
    const scanId = newId();
    await tx.insert(mapScans).values({
      id: scanId,
      organizationId: f.location.organizationId,
      locationId: f.location.id,
      checkId: f.checkId,
      keywordId,
      checkedAt: f.checkedAt,
      gridSize: size,
      radiusM: first.radiusM,
      centerLat: first.center.lat,
      centerLng: first.center.lng,
      yourTop3Spots: mine.top3Spots,
      yourAvgPosition: mine.avgPosition,
      yourDoorPosition: mine.doorPosition,
    });
    await tx.insert(mapPoints).values(
      rankings.map((ranking, idx) => {
        const at = where.get(idx) ?? first.center;
        const r = you ? ranking.indexOf(you) : -1;
        return { scanId, idx, lat: at.lat, lng: at.lng, yourRank: r < 0 ? null : r + 1, ranking };
      }),
    );
    const rows = [...standings].map(([placeId, s]) => ({ scanId, placeId, ...s }));
    if (you && !standings.has(you)) rows.push({ scanId, placeId: you, ...mine });
    if (rows.length) await tx.insert(mapStandings).values(rows);
  }
}

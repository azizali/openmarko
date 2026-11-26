// The map grid: where its spots are, and how a business did across them. Pure functions, no database.
//
// A grid is `size` × `size` spots (odd, so one sits on the business's door), spread so the outer ring is `radiusM`
// from the centre along each axis. Row 0 is the north edge, column 0 the west. A spot's index is row * size + col.

export type Spot = { idx: number; row: number; col: number; lat: number; lng: number };

const M_PER_DEG_LAT = 111_320;

export function spotsOf(center: { lat: number; lng: number }, size: number, radiusM: number): Spot[] {
  const c = (size - 1) / 2;
  const step = c === 0 ? 0 : radiusM / c;
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180);
  const spots: Spot[] = [];
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++)
      spots.push({
        idx: row * size + col,
        row,
        col,
        lat: round7(center.lat + ((c - row) * step) / M_PER_DEG_LAT),
        lng: round7(center.lng + ((col - c) * step) / mPerDegLng),
      });
  return spots;
}

const round7 = (n: number) => Math.round(n * 1e7) / 1e7;

/** Google Maps zoom for a grid: spots close together need a closer zoom, or every spot sees the same results. */
export function zoomFor(size: number, radiusM: number): number {
  const step = radiusM / Math.max(1, (size - 1) / 2);
  if (step <= 400) return 17;
  if (step <= 800) return 16;
  if (step <= 1600) return 15;
  if (step <= 3200) return 14;
  return 13;
}

/** Counted for a spot where the business isn't in the top 20. */
export const NOT_FOUND_RANK = 21;

export type Side = "north" | "south" | "east" | "west";

export type Standing = {
  top3Spots: number;
  avgPosition: number;
  doorPosition: number | null;
  bestSide: Side | null;
  worstSide: Side | null;
};

/**
 * How one business did on a grid, given its position at each spot (null: not in the top 20). Best and worst side
 * are by average position over the spots on that side of the door; null when it's in the top 3 nowhere.
 */
export function standingOf(size: number, ranks: (number | null)[]): Standing {
  const c = (size - 1) / 2;
  const at = (idx: number) => ranks[idx] ?? NOT_FOUND_RANK;
  const top3Spots = ranks.filter((r) => r !== null && r <= 3).length;
  const avgPosition = ranks.length ? round1(ranks.reduce<number>((n, _r, i) => n + at(i), 0) / ranks.length) : NOT_FOUND_RANK;
  const doorPosition = ranks[c * size + c] ?? null;
  if (top3Spots === 0 || size < 3) return { top3Spots, avgPosition, doorPosition, bestSide: null, worstSide: null };
  const sides: [Side, (row: number, col: number) => boolean][] = [
    ["north", (row) => row < c],
    ["south", (row) => row > c],
    ["east", (_row, col) => col > c],
    ["west", (_row, col) => col < c],
  ];
  const averages = sides
    .map(([side, on]) => {
      let sum = 0;
      let n = 0;
      for (let i = 0; i < ranks.length; i++)
        if (on(Math.floor(i / size), i % size)) {
          sum += at(i);
          n++;
        }
      return { side, avg: sum / n };
    })
    .sort((a, b) => a.avg - b.avg);
  return { top3Spots, avgPosition, doorPosition, bestSide: averages[0]!.side, worstSide: averages[averages.length - 1]!.side };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Standings for every business on a grid, from the order at each spot (ids, best first). A business missing from a
 * spot counts as not in the top 20 there.
 */
export function standingsOf(size: number, rankings: string[][]): Map<string, Standing> {
  const everyone = new Set(rankings.flat());
  const out = new Map<string, Standing>();
  for (const id of everyone)
    out.set(
      id,
      standingOf(
        size,
        rankings.map((r) => {
          const i = r.indexOf(id);
          return i < 0 ? null : i + 1;
        }),
      ),
    );
  return out;
}

import { and, desc, eq } from "drizzle-orm";
import { AppError, newId, type AppContext } from "@openmarko/kernel";
import { invoke } from "@openmarko/integrations";
import { gridPoints, gridScans } from "./schema";
import { activeLocation } from "./locations";
import { listCompetitors } from "./rankings";

/** Points of a size×size grid centred on the Location, `stepKm` apart. Odd sizes put the Location in the middle. */
export function gridPointsAround(
  lat: number,
  lng: number,
  size: number,
  stepKm: number,
): { row: number; col: number; lat: number; lng: number }[] {
  const half = Math.floor(size / 2);
  const out = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const dLat = ((half - row) * stepKm) / 111; // row 0 is the northern edge, as on a map
      const dLng = ((col - half) * stepKm) / (111 * Math.cos((lat * Math.PI) / 180));
      out.push({ row, col, lat: Number((lat + dLat).toFixed(6)), lng: Number((lng + dLng).toFixed(6)) });
    }
  }
  return out;
}

/**
 * Checks where the Location ranks in the local pack for one keyword, at every point of a grid.
 * Each point is one billed request (metered: dataforseo.request), so the size is the owner's cost.
 */
export async function scanGrid(
  ctx: AppContext,
  orgId: string,
  locationId: string,
  keyword: string,
  opts: { size?: number; stepKm?: number } = {},
  runId: string | null = null,
): Promise<string> {
  const loc = await activeLocation(ctx, orgId, locationId);
  if (loc.lat == null || loc.lng == null) throw new AppError(422, "invalid", "This Location needs coordinates before it can be scanned.");
  const size = opts.size ?? 5;
  const stepKm = opts.stepKm ?? 0.5;
  const names = [loc.name, ...(await listCompetitors(ctx, orgId, locationId)).map((c) => c.name)];
  const scanId = newId();
  await ctx.db.insert(gridScans).values({ id: scanId, organizationId: orgId, locationId, keyword, size, stepKm, runId });
  for (const p of gridPointsAround(loc.lat, loc.lng, size, stepKm)) {
    const { output } = await invoke<{ rank: number; name: string }[]>(
      ctx,
      orgId,
      "serp.read",
      { kind: "maps", keyword, names, coordinate: `${p.lat},${p.lng},15z` },
      { runId },
    );
    const rank = output.find((m) => m.name === loc.name)?.rank ?? null;
    await ctx.db
      .insert(gridPoints)
      .values({ id: newId(), organizationId: orgId, scanId, row: p.row, col: p.col, lat: p.lat, lng: p.lng, rank });
  }
  return scanId;
}

export async function listGridScans(ctx: AppContext, orgId: string, locationId: string) {
  await activeLocation(ctx, orgId, locationId);
  const scans = await ctx.db
    .select()
    .from(gridScans)
    .where(and(eq(gridScans.organizationId, orgId), eq(gridScans.locationId, locationId)))
    .orderBy(desc(gridScans.createdAt))
    .limit(20);
  const out = [];
  for (const s of scans) out.push({ ...s, points: await ctx.db.select().from(gridPoints).where(eq(gridPoints.scanId, s.id)) });
  return out;
}

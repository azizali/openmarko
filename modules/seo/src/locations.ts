// Scope lookups the SEO module shares: a Location or Website must belong to the Organization and be active.
import { and, eq, isNull } from "drizzle-orm";
import { conflict, notFound, type AppContext } from "@openmarko/kernel";
import { locations, websites } from "@openmarko/organizations/schema";

/** A Location that belongs to the Organization and isn't archived. */
export async function activeLocation(ctx: AppContext, orgId: string, locationId: string) {
  const [loc] = await ctx.db
    .select()
    .from(locations)
    .where(and(eq(locations.id, locationId), eq(locations.organizationId, orgId), isNull(locations.archivedAt)));
  if (!loc) throw notFound("Location");
  return loc;
}

/** Every active Location, or just `only` when a job targets one. */
export async function activeLocations(ctx: AppContext, orgId: string, only?: string | null) {
  const rows = await ctx.db
    .select()
    .from(locations)
    .where(and(eq(locations.organizationId, orgId), isNull(locations.archivedAt)));
  return rows.filter((l) => !only || l.id === only);
}

/** Locations with a Google Business Profile connected. Only these get profile, review and insight work (ADR 0011). */
export async function locationsWithProfile(ctx: AppContext, orgId: string, only?: string | null) {
  return (await activeLocations(ctx, orgId, only)).filter((l) => l.gbpId && l.gbpConnectionId);
}

export const profileGuard = (loc: { gbpId: string | null; gbpConnectionId: string | null }) => {
  if (!loc.gbpId || !loc.gbpConnectionId) throw conflict("Connect this Location's Google Business Profile first.");
};

/** A Website that belongs to the Organization and isn't archived. */
export async function activeWebsite(ctx: AppContext, orgId: string, websiteId: string) {
  const [w] = await ctx.db
    .select()
    .from(websites)
    .where(and(eq(websites.id, websiteId), eq(websites.organizationId, orgId), eq(websites.archived, false)));
  if (!w) throw notFound("Website");
  return w;
}

/** Every active Website, or just `only` when a job targets one. */
export async function activeWebsites(ctx: AppContext, orgId: string, only?: string | null) {
  const rows = await ctx.db
    .select()
    .from(websites)
    .where(and(eq(websites.organizationId, orgId), eq(websites.archived, false)));
  return rows.filter((w) => !only || w.id === only);
}

/** The Organization's first active Website: the one organic rankings are measured for. */
export async function primaryWebsite(ctx: AppContext, orgId: string) {
  return (await activeWebsites(ctx, orgId))[0] ?? null;
}

// Locations: the businesses an Organization tracks. A Location is a `draft` through onboarding and becomes `active`
// at Launch, when its checks are put on a schedule (automation's, one per Location) and the first one starts.
// Every function here takes the Organization's id and never reads another's rows.

import { and, eq, ne, sql } from "drizzle-orm";
import { conflict, invalid, logActivity, newId, notFound, type AppContext, type Tx } from "@app/kernel";
import { setSchedule } from "@app/automation";
import { aiEngines, domainOf, type AiEngine, type PlaceCandidate } from "@app/integrations";
import { assertUnderLimit, assertWithinCeiling, checksPerMonth, gridSizes, type CheckEvery } from "../access";
import { factsFromCandidate, upsertPlaces } from "../catalog/places";
import { locations, places, websites } from "../schema";

/** The job a Location's schedule runs: one check cycle (checks/jobs.ts). */
export const CHECK_JOB = "seo.check";

export type LocationRow = typeof locations.$inferSelect;

export type LocationView = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  lat: number;
  lng: number;
  timezone: string;
  countryCode: string;
  languageCode: string;
  services: string[];
  status: string;
  gridSize: number;
  gridRadiusM: number;
  checkEvery: string;
  engines: string[];
  website: string | null;
  googlePlaceId: string | null;
  profileLinked: boolean;
  createdAt: Date;
};

const view = (l: LocationRow, domain: string | null, googlePlaceId: string | null): LocationView => ({
  id: l.id,
  name: l.name,
  address: l.address,
  city: l.city,
  lat: l.lat,
  lng: l.lng,
  timezone: l.timezone,
  countryCode: l.countryCode,
  languageCode: l.languageCode,
  services: l.services,
  status: l.status,
  gridSize: l.gridSize,
  gridRadiusM: l.gridRadiusM,
  checkEvery: l.checkEvery,
  engines: l.engines,
  website: domain,
  googlePlaceId,
  profileLinked: !!l.gbpLocationName,
  createdAt: l.createdAt,
});

const withJoins = (ctx: AppContext) =>
  ctx.db
    .select({ l: locations, domain: websites.domain, googlePlaceId: places.googlePlaceId })
    .from(locations)
    .leftJoin(websites, eq(websites.id, locations.websiteId))
    .leftJoin(places, eq(places.id, locations.placeId));

export async function listLocations(ctx: AppContext, orgId: string): Promise<LocationView[]> {
  const rows = await withJoins(ctx)
    .where(and(eq(locations.organizationId, orgId), ne(locations.status, "archived")))
    .orderBy(locations.createdAt);
  return rows.map((r) => view(r.l, r.domain, r.googlePlaceId));
}

/** One Location of this Organization, or 404. */
export async function getLocation(ctx: AppContext, orgId: string, locationId: string): Promise<LocationRow> {
  const [row] = await ctx.db
    .select()
    .from(locations)
    .where(and(eq(locations.id, locationId), eq(locations.organizationId, orgId)));
  if (!row) throw notFound("Location");
  return row;
}

export async function getLocationView(ctx: AppContext, orgId: string, locationId: string): Promise<LocationView> {
  const [r] = await withJoins(ctx).where(and(eq(locations.id, locationId), eq(locations.organizationId, orgId)));
  if (!r) throw notFound("Location");
  return view(r.l, r.domain, r.googlePlaceId);
}

/** The Website for a domain, made the first time it's named. */
async function websiteFor(tx: Tx, orgId: string, url: string | null | undefined): Promise<string | null> {
  const domain = domainOf(url);
  if (!domain) return null;
  const [row] = await tx
    .insert(websites)
    .values({ id: newId(), organizationId: orgId, domain })
    .onConflictDoUpdate({ target: [websites.organizationId, websites.domain], set: { domain: sql`excluded.domain` } })
    .returning({ id: websites.id });
  return row!.id;
}

export type NewLocation = {
  /** The business as found on Google; its place joins the catalog. */
  place?: PlaceCandidate | null;
  name: string;
  address?: string | null;
  city?: string | null;
  lat: number;
  lng: number;
  timezone?: string | null;
  countryCode?: string | null;
  languageCode?: string | null;
  website?: string | null;
  services?: string[];
};

/** Adds a Location as a draft: nothing is checked until it's launched. Counts against the Plan's Locations. */
export async function createLocation(ctx: AppContext, orgId: string, by: string | null, input: NewLocation): Promise<string> {
  const [{ n }] = (await ctx.db
    .select({ n: sql<number>`count(*)::int` })
    .from(locations)
    .where(and(eq(locations.organizationId, orgId), ne(locations.status, "archived")))) as [{ n: number }];
  await assertUnderLimit(ctx, orgId, "locations", n);
  if (input.place) {
    const [same] = await ctx.db
      .select({ id: locations.id, status: locations.status })
      .from(locations)
      .innerJoin(places, eq(places.id, locations.placeId))
      .where(and(eq(locations.organizationId, orgId), eq(places.googlePlaceId, input.place.placeId), ne(locations.status, "archived")));
    if (same) throw conflict(`${input.place.name} is already set up.`, { locationId: same.id, status: same.status });
  }
  const id = newId();
  await ctx.db.transaction(async (tx) => {
    const placeIds = input.place ? await upsertPlaces(tx, [factsFromCandidate(input.place)], "lookup") : new Map<string, string>();
    await tx.insert(locations).values({
      id,
      organizationId: orgId,
      websiteId: await websiteFor(tx, orgId, input.website ?? input.place?.website),
      placeId: input.place ? (placeIds.get(input.place.placeId) ?? null) : null,
      name: input.name.trim(),
      address: input.address ?? input.place?.address ?? null,
      city: input.city ?? input.place?.city ?? null,
      lat: input.lat,
      lng: input.lng,
      timezone: input.timezone ?? input.place?.timezone ?? "UTC",
      countryCode: (input.countryCode ?? input.place?.countryCode ?? "US").toUpperCase(),
      languageCode: input.languageCode ?? "en",
      services: cleanList(input.services ?? []),
      status: "draft",
      createdBy: by,
    });
    await logActivity(tx, {
      organizationId: orgId,
      actorType: "member",
      actorId: by,
      action: "seo.manage",
      resourceType: "seo_location",
      resourceId: id,
      summary: `Added ${input.name.trim()} to SEO`,
    });
  });
  return id;
}

const cleanList = (xs: string[]) => [...new Set(xs.map((s) => s.trim()).filter(Boolean))].slice(0, 40);

export type LocationChange = {
  name?: string;
  website?: string | null;
  services?: string[];
  gridSize?: number;
  gridRadiusM?: number;
  checkEvery?: CheckEvery;
  engines?: AiEngine[];
};

/** Changes a Location. What a check costs (grid, how often) stays within the Plan; an active schedule follows. */
export async function updateLocation(ctx: AppContext, orgId: string, by: string | null, locationId: string, change: LocationChange) {
  const l = await getLocation(ctx, orgId, locationId);
  if (change.gridSize !== undefined) {
    if (!gridSizes.includes(change.gridSize as (typeof gridSizes)[number])) throw invalid("The grid is 5, 7 or 9 spots a side.");
    await assertWithinCeiling(ctx, orgId, "gridSize", change.gridSize);
  }
  if (change.gridRadiusM !== undefined && (change.gridRadiusM < 500 || change.gridRadiusM > 25_000))
    throw invalid("The grid reaches between 0.5 and 25 km from the business.");
  if (change.checkEvery !== undefined) await assertWithinCeiling(ctx, orgId, "checksPerMonth", checksPerMonth[change.checkEvery]);
  if (change.engines !== undefined && change.engines.some((e) => !aiEngines.includes(e))) throw invalid("Unknown AI assistant.");
  if (change.name !== undefined && !change.name.trim()) throw invalid("A Location needs a name.");

  await ctx.db.transaction(async (tx) => {
    await tx
      .update(locations)
      .set({
        ...(change.name !== undefined ? { name: change.name.trim() } : {}),
        ...(change.website !== undefined ? { websiteId: await websiteFor(tx, orgId, change.website) } : {}),
        ...(change.services !== undefined ? { services: cleanList(change.services) } : {}),
        ...(change.gridSize !== undefined ? { gridSize: change.gridSize } : {}),
        ...(change.gridRadiusM !== undefined ? { gridRadiusM: change.gridRadiusM } : {}),
        ...(change.checkEvery !== undefined ? { checkEvery: change.checkEvery } : {}),
        ...(change.engines !== undefined ? { engines: [...new Set(change.engines)] } : {}),
        updatedAt: new Date(),
      })
      .where(eq(locations.id, l.id));
    await logActivity(tx, {
      organizationId: orgId,
      actorType: "member",
      actorId: by,
      action: "seo.manage",
      resourceType: "seo_location",
      resourceId: l.id,
      summary: `Changed SEO settings for ${l.name}`,
      data: { change: Object.keys(change) },
    });
  });
  if (change.checkEvery !== undefined && l.status === "active") await scheduleChecks(ctx, orgId, l.id, change.checkEvery, false);
}

/** Puts a Location's checks on the automation schedule (or pauses them). */
export async function scheduleChecks(ctx: AppContext, orgId: string, locationId: string, every: string, paused: boolean) {
  await setSchedule(ctx, orgId, {
    jobId: CHECK_JOB,
    every: every as "daily" | "weekly" | "monthly",
    at: "06:00",
    targetType: "seo_location",
    targetId: locationId,
    paused,
  });
}

/** Sets a Location's status: active puts its checks on the schedule, paused and archived take them off. */
export async function setStatus(
  ctx: AppContext,
  orgId: string,
  by: string | null,
  locationId: string,
  status: "active" | "paused" | "archived",
) {
  const l = await getLocation(ctx, orgId, locationId);
  if (l.status === status) return;
  if (status === "active") await assertWithinCeiling(ctx, orgId, "checksPerMonth", checksPerMonth[l.checkEvery as CheckEvery] ?? 4);
  await ctx.db.transaction(async (tx) => {
    await tx.update(locations).set({ status, updatedAt: new Date() }).where(eq(locations.id, l.id));
    await logActivity(tx, {
      organizationId: orgId,
      actorType: "member",
      actorId: by,
      action: "seo.manage",
      resourceType: "seo_location",
      resourceId: l.id,
      summary: {
        active: `Started SEO checks for ${l.name}`,
        paused: `Paused SEO checks for ${l.name}`,
        archived: `Removed ${l.name} from SEO`,
      }[status],
    });
  });
  await scheduleChecks(ctx, orgId, l.id, l.checkEvery, status !== "active");
}

/** Links the Location to a Google Business Profile location the Organization's Google Connection manages. */
export async function linkProfile(
  ctx: AppContext,
  orgId: string,
  by: string | null,
  locationId: string,
  link: { connectionId: string; locationName: string } | null,
) {
  const l = await getLocation(ctx, orgId, locationId);
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(locations)
      .set({ gbpConnectionId: link?.connectionId ?? null, gbpLocationName: link?.locationName ?? null, updatedAt: new Date() })
      .where(eq(locations.id, l.id));
    await logActivity(tx, {
      organizationId: orgId,
      actorType: "member",
      actorId: by,
      action: "seo.manage",
      resourceType: "seo_location",
      resourceId: l.id,
      summary: link ? `Linked ${l.name} to its Google profile` : `Unlinked ${l.name} from its Google profile`,
    });
  });
}

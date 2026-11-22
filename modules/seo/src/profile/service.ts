// The Location's Google Business Profile, through the Organization's Google Connection (`profile.manage`): which
// profile locations the account manages, linking one to a Location (matched by Google's place id when it can be),
// reading and changing the profile, and the daily calls, clicks and views shown on the overview's results card.

import { and, eq, gte, sql } from "drizzle-orm";
import { conflict, type AppContext } from "@app/kernel";
import { invoke, listConnections, type DailyMetrics, type Profile, type ProfileChange, type ProfileLocation } from "@app/integrations";
import { getLocation, linkProfile, type LocationRow } from "../locations/service";
import { places, profileMetrics, profileSearchTerms } from "../schema";

/** The Organization's Google profile Connection, or null. */
export async function profileConnection(ctx: AppContext, orgId: string) {
  const conns = await listConnections(ctx, orgId);
  return conns.find((c) => c.capabilities.includes("profile.manage")) ?? null;
}

/** The profile locations the Organization's Google account manages. Empty when Google isn't connected. */
export async function profileLocations(ctx: AppContext, orgId: string): Promise<{ connected: boolean; locations: ProfileLocation[] }> {
  const conn = await profileConnection(ctx, orgId);
  if (!conn) return { connected: false, locations: [] };
  const out = await invoke<{ locations: ProfileLocation[] }>(ctx, orgId, "profile.manage", { op: "locations" }, { connectionId: conn.id });
  return { connected: true, locations: out.output.locations };
}

/**
 * Links a Location to a profile location, or picks the one with the Location's own place id when none is named.
 * Returns the linked name, or null when nothing matched.
 */
export async function linkLocationProfile(
  ctx: AppContext,
  orgId: string,
  by: string | null,
  locationId: string,
  name?: string | null,
): Promise<string | null> {
  const l = await getLocation(ctx, orgId, locationId);
  const conn = await profileConnection(ctx, orgId);
  if (!conn) throw conflict("Connect Google first.", { needs: "profile.manage" });
  const { locations } = await profileLocations(ctx, orgId);
  let pick = name ? locations.find((x) => x.name === name) : undefined;
  if (!pick && !name && l.placeId) {
    const [p] = await ctx.db.select({ key: places.googlePlaceId }).from(places).where(eq(places.id, l.placeId));
    pick = locations.find((x) => x.placeId && x.placeId === p?.key);
  }
  if (!pick) return null;
  await linkProfile(ctx, orgId, by, l.id, { connectionId: conn.id, locationName: pick.name });
  return pick.name;
}

/** The linked profile as Google has it now. Null when the Location isn't linked. */
export async function readProfile(ctx: AppContext, l: LocationRow): Promise<Profile | null> {
  if (!l.gbpConnectionId || !l.gbpLocationName) return null;
  const out = await invoke<{ profile: Profile }>(
    ctx,
    l.organizationId,
    "profile.manage",
    { op: "read", location: l.gbpLocationName },
    { connectionId: l.gbpConnectionId },
  );
  return out.output.profile;
}

const linked = (l: LocationRow) => {
  if (!l.gbpConnectionId || !l.gbpLocationName) throw conflict("Link this location's Google profile first.", { needs: "profile.manage" });
  return { connectionId: l.gbpConnectionId, location: l.gbpLocationName };
};

export async function changeProfile(ctx: AppContext, l: LocationRow, change: ProfileChange): Promise<void> {
  const g = linked(l);
  await invoke(ctx, l.organizationId, "profile.manage", { op: "update", location: g.location, change }, { connectionId: g.connectionId });
}

export async function publishPost(ctx: AppContext, l: LocationRow, text: string): Promise<string> {
  const g = linked(l);
  const out = await invoke<{ post: string }>(
    ctx,
    l.organizationId,
    "profile.manage",
    { op: "post", location: g.location, text },
    { connectionId: g.connectionId },
  );
  return out.output.post;
}

export async function deletePost(ctx: AppContext, l: LocationRow, post: string): Promise<void> {
  const g = linked(l);
  await invoke(ctx, l.organizationId, "profile.manage", { op: "deletePost", post }, { connectionId: g.connectionId });
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Fetches the last 35 days of calls, clicks and views, and last month's searches, for a linked Location. */
export async function syncProfileMetrics(ctx: AppContext, l: LocationRow, now = new Date()): Promise<void> {
  const g = linked(l);
  const to = new Date(now.getTime() - 2 * 86_400_000); // Google's numbers settle after a couple of days
  const from = new Date(to.getTime() - 34 * 86_400_000);
  const perf = await invoke<{ days: DailyMetrics[] }>(
    ctx,
    l.organizationId,
    "profile.manage",
    { op: "performance", location: g.location, from: isoDay(from), to: isoDay(to) },
    { connectionId: g.connectionId },
  );
  const days = perf.output.days;
  if (days.length)
    await ctx.db
      .insert(profileMetrics)
      .values(days.map((d) => ({ locationId: l.id, organizationId: l.organizationId, ...d })))
      .onConflictDoUpdate({
        target: [profileMetrics.locationId, profileMetrics.day],
        set: {
          calls: sql`excluded.calls`,
          websiteClicks: sql`excluded.website_clicks`,
          directionRequests: sql`excluded.direction_requests`,
          impressionsMaps: sql`excluded.impressions_maps`,
          impressionsSearch: sql`excluded.impressions_search`,
        },
      });
  const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const month = isoDay(lastMonth).slice(0, 7);
  const terms = await invoke<{ terms: { term: string; impressions: number }[] }>(
    ctx,
    l.organizationId,
    "profile.manage",
    { op: "searchTerms", location: g.location, month },
    { connectionId: g.connectionId },
  );
  const unique = [...new Map(terms.output.terms.map((t) => [t.term.toLowerCase().trim(), t])).entries()];
  if (unique.length)
    await ctx.db
      .insert(profileSearchTerms)
      .values(
        unique.map(([term, t]) => ({
          locationId: l.id,
          organizationId: l.organizationId,
          month: `${month}-01`,
          term,
          impressions: t.impressions,
        })),
      )
      .onConflictDoUpdate({
        target: [profileSearchTerms.locationId, profileSearchTerms.month, profileSearchTerms.term],
        set: { impressions: sql`excluded.impressions` },
      });
}

export type ResultsCard = {
  days: number;
  calls: number;
  websiteClicks: number;
  directionRequests: number;
  views: number;
  /** The same 28 days before. Null without a month of history. */
  before: { calls: number; websiteClicks: number; directionRequests: number; views: number } | null;
  topSearches: { term: string; impressions: number }[];
};

/** The overview's results card: the last 28 days from Google against the 28 before. Null when not linked or empty. */
export async function resultsCard(ctx: AppContext, l: LocationRow): Promise<ResultsCard | null> {
  if (!l.gbpLocationName) return null;
  const rows = await ctx.db
    .select()
    .from(profileMetrics)
    .where(and(eq(profileMetrics.locationId, l.id), gte(profileMetrics.day, isoDay(new Date(Date.now() - 70 * 86_400_000)))))
    .orderBy(profileMetrics.day);
  if (!rows.length) return null;
  const last = rows[rows.length - 1]!.day;
  const cut = (daysBack: number) => isoDay(new Date(new Date(`${last}T00:00:00Z`).getTime() - daysBack * 86_400_000));
  const sum = (from: string, to: string) => {
    const pick = rows.filter((r) => r.day > from && r.day <= to);
    return {
      n: pick.length,
      calls: pick.reduce((s, r) => s + r.calls, 0),
      websiteClicks: pick.reduce((s, r) => s + r.websiteClicks, 0),
      directionRequests: pick.reduce((s, r) => s + r.directionRequests, 0),
      views: pick.reduce((s, r) => s + r.impressionsMaps + r.impressionsSearch, 0),
    };
  };
  const now = sum(cut(28), last);
  const prev = sum(cut(56), cut(28));
  const top = await ctx.db
    .select({ term: profileSearchTerms.term, impressions: profileSearchTerms.impressions })
    .from(profileSearchTerms)
    .where(eq(profileSearchTerms.locationId, l.id))
    .orderBy(sql`${profileSearchTerms.month} desc, ${profileSearchTerms.impressions} desc`)
    .limit(5);
  return {
    days: now.n,
    calls: now.calls,
    websiteClicks: now.websiteClicks,
    directionRequests: now.directionRequests,
    views: now.views,
    before:
      prev.n >= 20
        ? { calls: prev.calls, websiteClicks: prev.websiteClicks, directionRequests: prev.directionRequests, views: prev.views }
        : null,
    topSearches: top,
  };
}

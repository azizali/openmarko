// `profile.manage` through Google's Business Profile APIs: list the locations the signed-in account manages, read a
// profile, change its categories or description, publish and delete posts, and read daily calls and clicks and the
// searches that showed it. Free to call; Google grants access per Cloud project (an application, reviewed by hand).
//
// Live calls follow Google's documented APIs but have not been run against an approved project yet. The stub answers
// from the stub market (stub-world.ts): every stub business is a location the account manages.

import { AppError } from "@app/kernel";
import type { Adapter, CallContext } from "../types";
import { hash, stubBusinesses, stubPlaceId } from "../search/stub-world";
import type { DailyMetrics, Profile, ProfileChange, ProfileInput, ProfileLocation, ProfileOutput } from "./contract";

const INFO = "https://mybusinessbusinessinformation.googleapis.com/v1";
const ACCOUNTS = "https://mybusinessaccountmanagement.googleapis.com/v1";
const V4 = "https://mybusiness.googleapis.com/v4";
const PERF = "https://businessprofileperformance.googleapis.com/v1";

async function google<T>(c: CallContext, method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${await c.accessToken()}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 || res.status === 403)
    throw new AppError(409, "needs_connection", "Google refused: connect the Google profile again.");
  if (!res.ok) throw new AppError(502, "provider_failed", `Google answered ${res.status}.`);
  return (res.status === 204 ? {} : await res.json()) as T;
}

/** `accounts/1/locations/2` → `locations/2`, what the v1 APIs take. */
const v1Name = (location: string) => location.slice(location.indexOf("locations/"));

// ---------- Live ----------

type ApiLocation = {
  name: string;
  title?: string;
  storefrontAddress?: { addressLines?: string[]; locality?: string };
  metadata?: { placeId?: string };
  categories?: {
    primaryCategory?: { name?: string; displayName?: string };
    additionalCategories?: { name?: string; displayName?: string }[];
  };
  profile?: { description?: string };
  websiteUri?: string;
  phoneNumbers?: { primaryPhone?: string };
  regularHours?: { periods?: unknown[] };
};

async function liveLocations(c: CallContext): Promise<ProfileLocation[]> {
  const { accounts = [] } = await google<{ accounts?: { name: string }[] }>(c, "GET", `${ACCOUNTS}/accounts`);
  const out: ProfileLocation[] = [];
  for (const a of accounts) {
    const { locations = [] } = await google<{ locations?: ApiLocation[] }>(
      c,
      "GET",
      `${INFO}/${a.name}/locations?readMask=name,title,storefrontAddress,metadata&pageSize=100`,
    );
    for (const l of locations)
      out.push({
        name: `${a.name}/${l.name}`,
        title: l.title ?? "",
        address: [...(l.storefrontAddress?.addressLines ?? []), l.storefrontAddress?.locality].filter(Boolean).join(", ") || null,
        placeId: l.metadata?.placeId ?? null,
      });
  }
  return out;
}

async function liveRead(c: CallContext, location: string): Promise<Profile> {
  const l = await google<ApiLocation>(
    c,
    "GET",
    `${INFO}/${v1Name(location)}?readMask=title,categories,profile,websiteUri,phoneNumbers,regularHours`,
  );
  return {
    title: l.title ?? "",
    primaryCategory: l.categories?.primaryCategory?.displayName ?? null,
    additionalCategories: (l.categories?.additionalCategories ?? []).map((x) => x.displayName ?? "").filter(Boolean),
    description: l.profile?.description ?? null,
    website: l.websiteUri ?? null,
    phone: l.phoneNumbers?.primaryPhone ?? null,
    hasHours: !!l.regularHours?.periods?.length,
  };
}

/** Google names categories by id (`categories/gcid:dentist`); a change names them as people read them. */
async function categoryIds(c: CallContext, names: string[]): Promise<{ name: string }[]> {
  const out: { name: string }[] = [];
  for (const displayName of names) {
    const filter = encodeURIComponent(`displayName=${displayName}`);
    const { categories = [] } = await google<{ categories?: { name: string; displayName: string }[] }>(
      c,
      "GET",
      `${INFO}/categories?regionCode=US&languageCode=en&view=BASIC&filter=${filter}`,
    );
    const hit = categories.find((x) => x.displayName.toLowerCase() === displayName.toLowerCase()) ?? categories[0];
    if (!hit) throw new AppError(422, "invalid", `Google has no category called "${displayName}".`);
    out.push({ name: hit.name });
  }
  return out;
}

async function liveUpdate(c: CallContext, location: string, change: ProfileChange): Promise<void> {
  const mask: string[] = [];
  const body: Record<string, unknown> = {};
  if (change.additionalCategories) {
    const current = await google<ApiLocation>(c, "GET", `${INFO}/${v1Name(location)}?readMask=categories`);
    body.categories = {
      primaryCategory: current.categories?.primaryCategory,
      additionalCategories: await categoryIds(c, change.additionalCategories),
    };
    mask.push("categories");
  }
  if (change.description !== undefined) {
    body.profile = { description: change.description };
    mask.push("profile.description");
  }
  if (!mask.length) return;
  await google(c, "PATCH", `${INFO}/${v1Name(location)}?updateMask=${mask.join(",")}`, body);
}

const ymd = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return { y: y!, m: m!, d: d! };
};

async function livePerformance(c: CallContext, location: string, from: string, to: string): Promise<DailyMetrics[]> {
  const metrics = {
    CALL_CLICKS: "calls",
    WEBSITE_CLICKS: "websiteClicks",
    BUSINESS_DIRECTION_REQUESTS: "directionRequests",
    BUSINESS_IMPRESSIONS_DESKTOP_MAPS: "impressionsMaps",
    BUSINESS_IMPRESSIONS_MOBILE_MAPS: "impressionsMaps",
    BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: "impressionsSearch",
    BUSINESS_IMPRESSIONS_MOBILE_SEARCH: "impressionsSearch",
  } as const;
  const a = ymd(from);
  const b = ymd(to);
  const q = new URLSearchParams([
    ...Object.keys(metrics).map((m) => ["dailyMetrics", m]),
    ["dailyRange.startDate.year", String(a.y)],
    ["dailyRange.startDate.month", String(a.m)],
    ["dailyRange.startDate.day", String(a.d)],
    ["dailyRange.endDate.year", String(b.y)],
    ["dailyRange.endDate.month", String(b.m)],
    ["dailyRange.endDate.day", String(b.d)],
  ]);
  type Series = {
    dailyMetric: keyof typeof metrics;
    timeSeries?: { datedValues?: { date: { year: number; month: number; day: number }; value?: string }[] };
  };
  const json = await google<{ multiDailyMetricTimeSeries?: { dailyMetricTimeSeries?: Series[] }[] }>(
    c,
    "GET",
    `${PERF}/${v1Name(location)}:fetchMultiDailyMetricsTimeSeries?${q}`,
  );
  const days = new Map<string, DailyMetrics>();
  for (const group of json.multiDailyMetricTimeSeries ?? [])
    for (const s of group.dailyMetricTimeSeries ?? [])
      for (const v of s.timeSeries?.datedValues ?? []) {
        const day = `${v.date.year}-${String(v.date.month).padStart(2, "0")}-${String(v.date.day).padStart(2, "0")}`;
        const row = days.get(day) ?? { day, calls: 0, websiteClicks: 0, directionRequests: 0, impressionsMaps: 0, impressionsSearch: 0 };
        row[metrics[s.dailyMetric]] += Number(v.value ?? 0);
        days.set(day, row);
      }
  return [...days.values()].sort((x, y) => x.day.localeCompare(y.day));
}

async function liveSearchTerms(c: CallContext, location: string, month: string) {
  const { y, m } = ymd(`${month}-01`);
  const q = new URLSearchParams({
    "monthlyRange.startMonth.year": String(y),
    "monthlyRange.startMonth.month": String(m),
    "monthlyRange.endMonth.year": String(y),
    "monthlyRange.endMonth.month": String(m),
    pageSize: "100",
  });
  type Count = { searchKeyword: string; insightsValue?: { value?: string; threshold?: string } };
  const json = await google<{ searchKeywordsCounts?: Count[] }>(
    c,
    "GET",
    `${PERF}/${v1Name(location)}/searchkeywords/impressions/monthly?${q}`,
  );
  // Google gives small counts as "fewer than N": we keep N as an upper bound.
  return (json.searchKeywordsCounts ?? []).map((k) => ({
    term: k.searchKeyword,
    impressions: Number(k.insightsValue?.value ?? k.insightsValue?.threshold ?? 0),
  }));
}

// ---------- Stub ----------

const stubLocationName = (slug: string) => `accounts/stub/locations/${slug}`;
const stubBiz = (location: string) => {
  const b = stubBusinesses.find((x) => stubLocationName(x.slug) === location);
  if (!b) throw new AppError(404, "not_found", "Google profile not found");
  return b;
};

function stubCall(input: ProfileInput): ProfileOutput {
  switch (input.op) {
    case "locations":
      return {
        locations: stubBusinesses.map((b) => ({
          name: stubLocationName(b.slug),
          title: b.name,
          address: b.address,
          placeId: stubPlaceId(b),
        })),
      };
    case "read": {
      const b = stubBiz(input.location);
      return {
        profile: {
          title: b.name,
          primaryCategory: b.categories[0] ?? b.category,
          additionalCategories: b.categories.slice(1),
          description: `${b.name} is a ${b.category.toLowerCase()} in Austin.`,
          website: b.domain ? `https://${b.domain}/` : null,
          phone: b.phone,
          hasHours: hash(`hours|${b.slug}`) > 0.3,
        },
      };
    }
    case "update":
      stubBiz(input.location);
      return { ok: true };
    case "post":
      return { post: `${input.location}/localPosts/stub_${crypto.randomUUID()}` };
    case "deletePost":
      return { ok: true };
    case "performance": {
      const b = stubBiz(input.location);
      const days: DailyMetrics[] = [];
      for (let d = new Date(`${input.from}T00:00:00Z`); d <= new Date(`${input.to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
        const day = d.toISOString().slice(0, 10);
        const n = (k: string, max: number) => Math.round(hash(`${k}|${b.slug}|${day}`) * max);
        days.push({
          day,
          calls: n("c", 9),
          websiteClicks: n("w", 14),
          directionRequests: n("d", 11),
          impressionsMaps: 40 + n("m", 120),
          impressionsSearch: 20 + n("s", 60),
        });
      }
      return { days };
    }
    case "searchTerms": {
      const b = stubBiz(input.location);
      const terms = [
        "dentist near me",
        `${b.category.toLowerCase()} austin`,
        b.name.toLowerCase(),
        "teeth whitening",
        "emergency dentist",
        "dentist open saturday",
      ];
      return { terms: terms.map((term) => ({ term, impressions: 15 + Math.round(hash(`t|${b.slug}|${term}|${input.month}`) * 400) })) };
    }
  }
}

export const googleBusinessProfile: Adapter = {
  provider: "google_business",
  capabilities: ["profile.manage"],
  call: async (_capability, raw, c) => {
    const input = raw as ProfileInput;
    if (c.mode === "stub") return { output: stubCall(input), quantity: 0, costMicros: 0 };
    let output: ProfileOutput;
    switch (input.op) {
      case "locations":
        output = { locations: await liveLocations(c) };
        break;
      case "read":
        output = { profile: await liveRead(c, input.location) };
        break;
      case "update":
        await liveUpdate(c, input.location, input.change);
        output = { ok: true };
        break;
      case "post": {
        const post = await google<{ name: string }>(c, "POST", `${V4}/${input.location}/localPosts`, {
          languageCode: "en-US",
          summary: input.text,
          topicType: "STANDARD",
        });
        output = { post: post.name };
        break;
      }
      case "deletePost":
        await google(c, "DELETE", `${V4}/${input.post}`);
        output = { ok: true };
        break;
      case "performance":
        output = { days: await livePerformance(c, input.location, input.from, input.to) };
        break;
      case "searchTerms":
        output = { terms: await liveSearchTerms(c, input.location, input.month) };
        break;
    }
    return { output, quantity: 0, costMicros: 0 };
  },
};

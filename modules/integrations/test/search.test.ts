// Search data (DataForSEO), finding a business (Google Places) and the Google Business Profile: the stubs answer
// from the stub market, live calls send what the providers expect and read what they return, and connecting
// Google goes through OAuth (or a stub when the app has no OAuth client).
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { createTestDb, ownerSession, type Session, type TestDb } from "@app/testkit";
import { assignPlanManually, upsertPlan, usageEvents } from "@app/billing";
import { eq } from "drizzle-orm";
import {
  adapterFor,
  connect,
  finishOAuth,
  invoke,
  listConnections,
  readState,
  signState,
  startOAuth,
  type CollectOutput,
  type MapsQuery,
  type MapsResult,
  type PostOutput,
} from "../src";
import type { CallContext } from "../src/adapters/types";

let t: TestDb;
let owner: Session;

beforeAll(async () => {
  t = await createTestDb();
  owner = await ownerSession(t.ctx);
  // A Plan that sells no SEO meter: search data is cost-only, so it must still go through.
  await upsertPlan(t.ctx, { id: "basic", name: "Basic", entitlements: {}, meters: [] });
  await assignPlanManually(t.ctx, owner.orgId, "basic");
  await connect(t.ctx, {
    organizationId: null,
    providerId: "dataforseo",
    target: { type: "app", id: null },
    label: "DataForSEO",
    settings: { login: "me@app.test" },
    secrets: { password: "x" },
  });
});
afterAll(() => t.teardown());

const query: MapsQuery = { keyword: "dentist austin", at: { lat: 30.2509, lng: -97.7497 }, zoom: 15, languageCode: "en", depth: 20 };

describe("search data through invoke, stub mode", () => {
  test("posting is billed to the app (recorded, never blocked by the Plan); collecting is free", async () => {
    const posted = await invoke<PostOutput<MapsResult>>(t.ctx, owner.orgId, "search.maps", {
      op: "post",
      queue: "standard",
      pingbackUrl: null,
      queries: [{ tag: "a", query }],
    });
    expect(posted.output.posted).toHaveLength(1);
    expect(posted.output.posted[0]!.costMicros).toBe(600);

    const collected = await invoke<CollectOutput<MapsResult>>(t.ctx, owner.orgId, "search.maps", {
      op: "collect",
      tasks: [{ externalId: posted.output.posted[0]!.externalId, query }],
    });
    const first = collected.output.collected[0]!;
    expect(first.status).toBe("ready");
    if (first.status !== "ready") return;
    expect(first.result.items.length).toBe(12);
    expect(first.result.items[0]).toMatchObject({ position: 1, placeId: expect.stringMatching(/^stub_place_/) });

    const usage = await t.ctx.db.select().from(usageEvents).where(eq(usageEvents.organizationId, owner.orgId));
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ meter: "seo.requests", quantity: 1, costMicros: 600 });
  });

  test("the same question gives the same answer within a week", async () => {
    const a = adapterFor("dataforseo")!;
    const c = stubCtx();
    const run = async () =>
      ((await a.call("search.maps", { op: "collect", tasks: [{ externalId: "x", query }] }, c)).output as CollectOutput<MapsResult>)
        .collected[0];
    expect(await run()).toEqual(await run());
  });

  test("keyword volumes and ideas", async () => {
    const vol = await invoke<{ metrics: { term: string; monthlySearches: number }[] }>(t.ctx, owner.orgId, "search.keywords", {
      op: "volume",
      terms: ["Dentist Austin", "dentist austin"],
      countryCode: "US",
      languageCode: "en",
    });
    expect(vol.output.metrics).toHaveLength(1);
    expect(vol.output.metrics[0]!.monthlySearches).toBeGreaterThan(0);
    const ideas = await invoke<{ ideas: { term: string }[] }>(t.ctx, owner.orgId, "search.keywords", {
      op: "ideas",
      domain: "mapleandmaindental.com",
      seeds: ["dentist austin"],
      countryCode: "US",
      languageCode: "en",
      limit: 20,
    });
    expect(ideas.output.ideas.map((i) => i.term)).toContain("dentist austin");
  });
});

const realFetch = globalThis.fetch;
let seen: { url: string; init: RequestInit }[] = [];
afterEach(() => {
  globalThis.fetch = realFetch;
  seen = [];
});
/** Answers each fetch with the next response, and records what was asked. */
function fakeFetch(...responses: unknown[]) {
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen.push({ url: String(url), init });
    return Response.json(responses.shift() ?? {});
  }) as typeof fetch;
}
const stubCtx = (): CallContext => ({
  mode: "stub",
  provider: "dataforseo",
  externalId: null,
  secrets: async () => ({}),
  settings: {},
  accessToken: async () => "",
});
const liveCtx = (
  provider: CallContext["provider"],
  secrets: Record<string, string>,
  settings: Record<string, string> = {},
): CallContext => ({
  mode: "live",
  provider,
  externalId: null,
  secrets: async () => secrets,
  settings,
  accessToken: async () => "token-1",
});

describe("DataForSEO, live", () => {
  test("posts Maps tasks with the spot, zoom and pingback, and reads the task ids and costs", async () => {
    fakeFetch({
      status_code: 20000,
      status_message: "Ok.",
      tasks: [{ id: "t-1", status_code: 20100, status_message: "Task Created.", cost: 0.0006, data: { tag: "a" } }],
    });
    const out = await adapterFor("dataforseo")!.call(
      "search.maps",
      { op: "post", queue: "priority", pingbackUrl: "https://api.test/ready?id={id}", queries: [{ tag: "a", query }] },
      liveCtx("dataforseo", { password: "p" }, { login: "l" }),
    );
    expect(out.output).toEqual({ posted: [{ tag: "a", externalId: "serp/google/maps|t-1", costMicros: 600 }] });
    expect(seen[0]!.url).toBe("https://api.dataforseo.com/v3/serp/google/maps/task_post");
    expect((seen[0]!.init.headers as Record<string, string>).authorization).toBe(`Basic ${btoa("l:p")}`);
    const [body] = JSON.parse(String(seen[0]!.init.body));
    expect(body).toMatchObject({
      keyword: "dentist austin",
      location_coordinate: "30.2509000,-97.7497000,15z",
      priority: 2,
      pingback_url: "https://api.test/ready?id=$id",
    });
  });

  test("collects a Maps result, a pending task and a failed one", async () => {
    fakeFetch(
      {
        status_code: 20000,
        tasks: [
          {
            id: "t-1",
            status_code: 20000,
            result: [
              {
                items: [
                  {
                    type: "maps_search",
                    rank_group: 1,
                    title: "Bright Smile Austin",
                    domain: "www.brightsmileaustin.com",
                    category: "Dentist",
                    additional_categories: ["Teeth whitening service"],
                    place_id: "ChIJ1",
                    cid: "123",
                    rating: { value: 4.9, votes_count: 538 },
                    is_claimed: true,
                    latitude: 30.25,
                    longitude: -97.76,
                  },
                  { type: "maps_paid_item", title: "Ad" },
                ],
              },
            ],
          },
        ],
      },
      { status_code: 20000, tasks: [{ id: "t-2", status_code: 40602, status_message: "Task In Queue." }] },
      { status_code: 20000, tasks: [{ id: "t-3", status_code: 40400, status_message: "Not Found." }] },
    );
    const out = (
      await adapterFor("dataforseo")!.call(
        "search.maps",
        {
          op: "collect",
          tasks: ["t-1", "t-2", "t-3"].map((id) => ({ externalId: `serp/google/maps|${id}`, query })),
        },
        liveCtx("dataforseo", { password: "p" }, { login: "l" }),
      )
    ).output as CollectOutput<MapsResult>;
    expect(out.collected.map((c) => c.status)).toEqual(["ready", "pending", "failed"]);
    const ready = out.collected[0]!;
    if (ready.status !== "ready") throw new Error("not ready");
    expect(ready.result.items).toEqual([
      expect.objectContaining({
        position: 1,
        name: "Bright Smile Austin",
        domain: "brightsmileaustin.com",
        categories: ["Dentist", "Teeth whitening service"],
        rating: 4.9,
        reviewCount: 538,
        placeId: "ChIJ1",
      }),
    ]);
  });

  test("reads Google search: positions, map pack, AI Overview citations and People also ask", async () => {
    fakeFetch({
      status_code: 20000,
      tasks: [
        {
          id: "t",
          status_code: 20000,
          result: [
            {
              items: [
                { type: "local_pack", title: "x" },
                { type: "ai_overview", items: [{ text: "Dentists…", references: [{ domain: "yelp.com", url: "https://yelp.com/a" }] }] },
                { type: "organic", rank_group: 1, domain: "www.yelp.com", url: "https://www.yelp.com/a", title: "Best" },
                { type: "people_also_ask", items: [{ title: "How much is a cleaning?" }] },
              ],
            },
          ],
        },
      ],
    });
    const out = (
      await adapterFor("dataforseo")!.call(
        "search.organic",
        { op: "collect", tasks: [{ externalId: "serp/google/organic|t", query: { ...query, depth: 10 } }] },
        liveCtx("dataforseo", { password: "p" }, { login: "l" }),
      )
    ).output as CollectOutput<unknown>;
    expect(out.collected[0]).toEqual({
      externalId: "serp/google/organic|t",
      status: "ready",
      result: {
        items: [{ position: 1, domain: "yelp.com", url: "https://www.yelp.com/a", title: "Best" }],
        mapPack: true,
        aiOverview: { shown: true, citedDomains: ["yelp.com"] },
        peopleAlsoAsk: ["How much is a cleaning?"],
      },
    });
  });
});

describe("Google Places", () => {
  test("live: a text search becomes candidates with country, city and time zone", async () => {
    fakeFetch({
      places: [
        {
          id: "ChIJ9",
          displayName: { text: "Maple & Main Dental" },
          formattedAddress: "1204 S Congress Ave, Austin, TX 78704, USA",
          location: { latitude: 30.25, longitude: -97.75 },
          websiteUri: "https://mapleandmaindental.com/",
          addressComponents: [
            { shortText: "US", types: ["country"] },
            { longText: "Austin", types: ["locality"] },
          ],
          timeZone: { id: "America/Chicago" },
        },
      ],
    });
    const out = await adapterFor("google_places")!.call(
      "places.find",
      { query: "maple main dental" },
      liveCtx("google_places", { apiKey: "k" }),
    );
    expect(out.output).toEqual({
      places: [
        expect.objectContaining({
          placeId: "ChIJ9",
          name: "Maple & Main Dental",
          countryCode: "US",
          city: "Austin",
          timezone: "America/Chicago",
        }),
      ],
    });
    expect((seen[0]!.init.headers as Record<string, string>)["x-goog-api-key"]).toBe("k");
  });

  test("stub: offers the stub market's businesses, matching the name first", async () => {
    const out = await adapterFor("google_places")!.call(
      "places.find",
      { query: "Bright Smile" },
      { ...stubCtx(), provider: "google_places" },
    );
    expect((out.output as { places: { name: string }[] }).places[0]!.name).toBe("Bright Smile Austin");
  });
});

describe("Google Business Profile", () => {
  test("live: reads a profile with a bearer token", async () => {
    fakeFetch({
      title: "Maple & Main Dental",
      categories: { primaryCategory: { displayName: "Dentist" }, additionalCategories: [{ displayName: "Cosmetic dentist" }] },
      profile: { description: "A family practice." },
      regularHours: { periods: [{}] },
    });
    const out = await adapterFor("google_business")!.call(
      "profile.manage",
      { op: "read", location: "accounts/1/locations/2" },
      liveCtx("google_business", {}),
    );
    expect(out.output).toEqual({
      profile: {
        title: "Maple & Main Dental",
        primaryCategory: "Dentist",
        additionalCategories: ["Cosmetic dentist"],
        description: "A family practice.",
        website: null,
        phone: null,
        hasHours: true,
      },
    });
    expect(seen[0]!.url).toStartWith("https://mybusinessbusinessinformation.googleapis.com/v1/locations/2?readMask=");
    expect((seen[0]!.init.headers as Record<string, string>).authorization).toBe("Bearer token-1");
  });

  test("live: daily performance adds mobile and desktop impressions together", async () => {
    const v = (value: string) => ({ date: { year: 2026, month: 11, day: 1 }, value });
    fakeFetch({
      multiDailyMetricTimeSeries: [
        {
          dailyMetricTimeSeries: [
            { dailyMetric: "CALL_CLICKS", timeSeries: { datedValues: [v("3")] } },
            { dailyMetric: "BUSINESS_IMPRESSIONS_MOBILE_MAPS", timeSeries: { datedValues: [v("40")] } },
            { dailyMetric: "BUSINESS_IMPRESSIONS_DESKTOP_MAPS", timeSeries: { datedValues: [v("10")] } },
          ],
        },
      ],
    });
    const out = await adapterFor("google_business")!.call(
      "profile.manage",
      { op: "performance", location: "accounts/1/locations/2", from: "2026-11-01", to: "2026-11-01" },
      liveCtx("google_business", {}),
    );
    expect(out.output).toEqual({
      days: [{ day: "2026-11-01", calls: 3, websiteClicks: 0, directionRequests: 0, impressionsMaps: 50, impressionsSearch: 0 }],
    });
  });
});

describe("connecting with OAuth", () => {
  test("without the app's OAuth client, start connects a stub and comes straight back", async () => {
    const res = await startOAuth(t.ctx, {
      organizationId: owner.orgId,
      userId: owner.userId,
      providerId: "google_business",
      returnTo: "/seo/settings",
    });
    expect(res.url).toBe("/seo/settings?connected=google_business");
    const conns = await listConnections(t.ctx, owner.orgId);
    expect(conns.find((c) => c.providerId === "google_business")).toMatchObject({ mode: "stub", capabilities: ["profile.manage"] });
  });

  test("with a client, start sends to Google's consent screen; the callback stores the refresh token", async () => {
    const ctx = { ...t.ctx, cfg: { ...t.ctx.cfg, google: { clientId: "cid", clientSecret: "secret" } } };
    const { url } = await startOAuth(ctx, {
      organizationId: owner.orgId,
      userId: owner.userId,
      providerId: "google_business",
      returnTo: "/seo",
    });
    const consent = new URL(url);
    expect(consent.origin + consent.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(consent.searchParams.get("redirect_uri")).toBe(`${t.cfg.appUrl}/api/v1/oauth/google_business/callback`);
    expect(consent.searchParams.get("access_type")).toBe("offline");

    fakeFetch({ access_token: "a", refresh_token: "r", expires_in: 3600 });
    const back = await finishOAuth(ctx, "google_business", { code: "c", state: consent.searchParams.get("state")! });
    expect(back).toBe("/seo?connected=google_business");
    const live = (await listConnections(t.ctx, owner.orgId)).find((c) => c.providerId === "google_business");
    expect(live?.mode).toBe("live");
  });

  test("a state can't be forged, reused for another provider, or used late", async () => {
    const s = signState(t.ctx, { o: owner.orgId, u: owner.userId, p: "google_business", r: "/seo" });
    expect(readState(t.ctx, s).o).toBe(owner.orgId);
    expect(() => readState(t.ctx, `${s.split(".")[0]}.bad`)).toThrow();
    expect(() => readState(t.ctx, s, Date.now() + 11 * 60_000)).toThrow();
    await expect(finishOAuth(t.ctx, "slack", { code: "c", state: s })).rejects.toThrow();
  });

  test("a return address outside the app is ignored", async () => {
    const res = await startOAuth(t.ctx, {
      organizationId: owner.orgId,
      userId: owner.userId,
      providerId: "google_business",
      returnTo: "//evil.test",
    });
    expect(res.url).toBe("/?connected=google_business");
  });
});

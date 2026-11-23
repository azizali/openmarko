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

  test("reads a business's profile: every category, attributes, and what customers mention", async () => {
    fakeFetch({
      status_code: 20000,
      cost: 0.0054,
      tasks: [
        {
          id: "t-1",
          status_code: 20000,
          result: [
            {
              items: [
                {
                  category: "Dentist",
                  additional_categories: ["Cosmetic dentist", "Emergency dental service"],
                  description: "A family practice.",
                  attributes: { available_attributes: { accessibility: ["Wheelchair accessible entrance"] } },
                  place_topics: { whitening: 12, "front desk": 40 },
                  people_also_search: [{ title: "Bright Smile Austin" }],
                },
              ],
            },
          ],
        },
      ],
    });
    const out = await adapterFor("dataforseo")!.call(
      "places.details",
      { placeId: "ChIJ9", name: "Maple & Main Dental", languageCode: "en", countryCode: "US" },
      liveCtx("dataforseo", { password: "p" }, { login: "l" }),
    );
    expect(seen[0]!.url).toBe("https://api.dataforseo.com/v3/business_data/google/my_business_info/live");
    expect(JSON.parse(String(seen[0]!.init.body))[0].keyword).toBe("place_id:ChIJ9");
    expect(out.costMicros).toBe(5400);
    expect(out.output.details).toMatchObject({
      primaryCategory: "Dentist",
      categories: ["Dentist", "Cosmetic dentist", "Emergency dental service"],
      attributes: ["Wheelchair accessible entrance"],
      topics: [
        { term: "front desk", mentions: 40 },
        { term: "whitening", mentions: 12 },
      ],
    });
  });

  test("reads a real My Business Info response: no additional categories, attributes or neighbours", async () => {
    // Recorded from DataForSEO (trimmed): a profile with one category and nulls where it lists nothing.
    fakeFetch({
      status_code: 20000,
      cost: 0.0054,
      tasks: [
        {
          id: "t",
          status_code: 20000,
          result: [
            {
              items_count: 1,
              items: [
                {
                  type: "google_business_info",
                  title: "United States Pest Service, LLC",
                  description: "Family-owned pest control in Middletown, NY.",
                  category: "Pest control service",
                  category_ids: null,
                  additional_categories: null,
                  attributes: null,
                  people_also_search: null,
                  place_topics: { "wasp nest removal": 10, "knowledgeable staff": 59, "mice issues": 2 },
                },
              ],
            },
          ],
        },
      ],
    });
    const out = await adapterFor("dataforseo")!.call(
      "places.details",
      { placeId: "ChIJ4Q__zxAzw4kRFzlUmIncf3g", name: "United States Pest Service, LLC", languageCode: "en", countryCode: "US" },
      liveCtx("dataforseo", { password: "p" }, { login: "l" }),
    );
    expect(out.output.details).toEqual({
      primaryCategory: "Pest control service",
      categories: ["Pest control service"],
      description: "Family-owned pest control in Middletown, NY.",
      attributes: [],
      topics: [
        { term: "knowledgeable staff", mentions: 59 },
        { term: "wasp nest removal", mentions: 10 },
        { term: "mice issues", mentions: 2 },
      ],
      questions: [],
      nearby: [],
    });
  });

  test("reads Google's category list: ids shown as Google shows them", async () => {
    // Recorded from DataForSEO (trimmed): one entry per category, named by id.
    fakeFetch({
      status_code: 20000,
      cost: 0,
      tasks: [
        {
          id: "t",
          status_code: 20000,
          result: [
            { category_name: "restaurant", business_count: 6591762 },
            { category_name: "pest_control_service", business_count: 120000 },
            { category_name: "pest_control_service", business_count: 1 },
          ],
        },
      ],
    });
    const out = await adapterFor("dataforseo")!.call(
      "places.details",
      { op: "categories" },
      liveCtx("dataforseo", { password: "p" }, { login: "l" }),
    );
    expect(seen[0]!.url).toBe("https://api.dataforseo.com/v3/business_data/business_listings/categories");
    expect(out.output).toEqual({
      categories: [
        { name: "Restaurant", businesses: 6591762 },
        { name: "Pest control service", businesses: 120000 },
      ],
    });
    expect(out.costMicros).toBe(0);
  });

  test("reads the places Google can search from in a country, each with its own code", async () => {
    // Recorded from DataForSEO (trimmed): two towns of one name, told apart by the code and the state in the path.
    fakeFetch({
      status_code: 20000,
      cost: 0,
      tasks: [
        {
          id: "t",
          status_code: 20000,
          result: [
            { location_code: 1016154, location_name: "Springfield,Illinois,United States", location_type: "City" },
            { location_code: 1018511, location_name: "Springfield,Missouri,United States", location_type: "City" },
            { location_code: 21176, location_name: "Texas,United States", location_type: "State" },
          ],
        },
      ],
    });
    const out = await adapterFor("dataforseo")!.call(
      "places.details",
      { op: "locations", countryCode: "US" },
      liveCtx("dataforseo", { password: "p" }, { login: "l" }),
    );
    expect(seen[0]!.url).toBe("https://api.dataforseo.com/v3/serp/google/locations/us");
    expect(out.output).toEqual({
      locations: [
        { code: 1016154, name: "Springfield,Illinois,United States", type: "City" },
        { code: 1018511, name: "Springfield,Missouri,United States", type: "City" },
        { code: 21176, name: "Texas,United States", type: "State" },
      ],
    });
    expect(out.costMicros).toBe(0);
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

  test("live: keeps a multi-word category and a multi-word city whole, and shows the category Google gives", async () => {
    fakeFetch({
      places: [
        {
          id: "ChIJ1",
          displayName: { text: "Bay Pest Control" },
          location: { latitude: 37.77, longitude: -122.41 },
          primaryTypeDisplayName: { text: "Pest control service" },
          addressComponents: [
            { shortText: "US", types: ["country"] },
            { longText: "San Francisco", types: ["locality"] },
          ],
        },
        // Google's own type list is short: a business it has no type for comes back as plain "Service".
        {
          id: "ChIJ2",
          displayName: { text: "Other Pest Co" },
          location: { latitude: 1, longitude: 1 },
          primaryTypeDisplayName: { text: "Service" },
        },
      ],
    });
    const out = await adapterFor("google_places")!.call(
      "places.find",
      { query: "bay pest control" },
      liveCtx("google_places", { apiKey: "k" }),
    );
    const found = (out.output as { places: { category: string; city: string | null }[] }).places;
    expect(found[0]).toMatchObject({ category: "Pest control service", city: "San Francisco" });
    expect(found[1]!.category).toBe("Service");
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

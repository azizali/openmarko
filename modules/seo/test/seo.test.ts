// SEO end to end, in stub mode (the stub market: dental practices around South Congress, Austin): setting up a
// Location, launching it, the worker collecting and filing results, every page's numbers, suggestions with Apply and
// Undo through automation Tasks, and who may do what.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";
import { assignPlanManually, upsertPlan } from "@app/billing";
import { connect } from "@app/integrations";
import { addMember } from "@app/organizations";
import { adminSession, composedApp, createTestDb, ownerSession, requester, userSession, type Session, type TestDb } from "@app/testkit";
import { collectCheck, COLLECT_JOB, CHECK_JOB, dueChecks, startCycle, generateSuggestions } from "../src";
import { checks, keywords, mapPoints, mapScans, places, suggestions } from "../src/schema";

let t: TestDb;
let call: ReturnType<typeof requester>;
let owner: Session;
let queued: { name: string; data: Record<string, unknown> }[] = [];

const base = (s: Session) => `/api/v1/organizations/${s.orgId}/seo`;

/** Runs what the worker would: collections, and checks queued for what was just added. */
async function drain() {
  for (let guard = 0; guard < 10 && queued.length; guard++) {
    const jobs = queued;
    queued = [];
    for (const j of jobs) {
      if (j.name === COLLECT_JOB) await collectCheck(t.ctx, String(j.data.checkId));
      if (j.name === CHECK_JOB)
        await startCycle(t.ctx, String(j.data.organizationId), String(j.data.targetId), {
          queue: "standard",
          scope: j.data.scope as never,
        });
    }
  }
}

beforeAll(async () => {
  t = await createTestDb();
  call = requester(await composedApp(t.ctx));
  t.ctx.enqueue = async (name, data) => void queued.push({ name, data });
  for (const providerId of ["dataforseo", "google_places"] as const)
    await connect(t.ctx, {
      organizationId: null,
      providerId,
      target: { type: "app", id: null },
      label: providerId,
      secrets: { password: "x", apiKey: "x" },
    });
  await upsertPlan(t.ctx, {
    id: "local",
    name: "Local",
    entitlements: {
      "feature.seo": 1,
      "limit.seo_locations": 2,
      "limit.seo_keywords": 8,
      "limit.seo_questions": 6,
      "limit.seo_grid_size": 7,
      "limit.seo_checks_per_month": 4,
    },
    meters: [],
  });
  owner = await ownerSession(t.ctx, { orgName: "Maple & Main" });
  await assignPlanManually(t.ctx, owner.orgId, "local");
});
afterAll(() => t.teardown());

let locationId = "";

describe("setting up a Location (onboarding)", () => {
  test("finds the business on Google and adds it as a draft", async () => {
    const found = await call("POST", `${base(owner)}/find`, { headers: owner.headers, body: { query: "Maple Main Dental" } });
    expect(found.status).toBe(200);
    const place = found.body[0];
    expect(place).toMatchObject({ name: "Maple & Main Dental", city: "Austin", countryCode: "US" });

    const made = await call("POST", `${base(owner)}/locations`, {
      headers: owner.headers,
      body: { place, name: place.name, lat: place.lat, lng: place.lng },
    });
    expect(made.status).toBe(200);
    locationId = made.body.id;
    const again = await call("POST", `${base(owner)}/locations`, {
      headers: owner.headers,
      body: { place, name: place.name, lat: place.lat, lng: place.lng },
    });
    expect(again.status).toBe(409);
    expect(again.body.details.locationId).toBe(locationId);
    const got = await call("GET", `${base(owner)}/locations/${locationId}`, { headers: owner.headers });
    expect(got.body).toMatchObject({
      status: "draft",
      website: "mapleandmaindental.com",
      city: "Austin",
      timezone: "America/Chicago",
      gridSize: 7,
    });
  });

  test("suggests services, local keywords with their searches, and questions", async () => {
    const ideas = await call("GET", `${base(owner)}/locations/${locationId}/ideas`, { headers: owner.headers });
    expect(ideas.status).toBe(200);
    // Three lists, each searched differently. Maps: short, no place (the grid says where). Google search: with the place.
    const mapsTerms = ideas.body.maps.map((k: { term: string }) => k.term);
    const organicTerms = ideas.body.organic.map((k: { term: string }) => k.term);
    expect(mapsTerms.length).toBeGreaterThan(3);
    expect(mapsTerms).toContain("dentist");
    expect(mapsTerms.filter((t: string) => t.includes("austin"))).toEqual([]);
    expect(organicTerms.length).toBeGreaterThan(mapsTerms.length / 2);
    expect(organicTerms).toContain("dentist austin");
    expect(organicTerms.every((t: string) => /austin|near me|dentist/.test(t))).toBe(true);
    // Every one with its searches a month, most searched first.
    const volumes = ideas.body.organic.map((k: { monthlySearches: number | null }) => k.monthlySearches ?? -1);
    expect(volumes).toEqual(volumes.toSorted((a: number, b: number) => b - a));
    expect(ideas.body.problem).toBeNull();
    expect(ideas.body.questions[0]).toBe("Who is the best dentist in Austin?");
    expect(ideas.body.services.length).toBeGreaterThan(0);
    // Services say what the business does, not where.
    expect(ideas.body.services.filter((x: string) => /austin|\btx\b/.test(x))).toEqual([]);
  });

  test("offers the business's full profile: every category, nearby cities, what customers mention", async () => {
    const d = await call("GET", `${base(owner)}/locations/${locationId}/details`, { headers: owner.headers });
    expect(d.status).toBe(200);
    expect(d.body.enriched).toBe(true);
    expect(d.body.categories.slice(0, 2)).toEqual(["Dentist", "Cosmetic dentist"]);
    expect(d.body.cities[0]).toBe("Austin, TX"); // the profile's "Austin" is the one in the business's own state
    expect(d.body.cities.length).toBeGreaterThan(1);
    expect(d.body.topics.length).toBeGreaterThan(0);
    expect(d.body.questions.length).toBeGreaterThan(0);
  });

  test("offers Google's categories: related ones to add, and a lookup that only knows real ones", async () => {
    const d = await call("GET", `${base(owner)}/locations/${locationId}/details`, { headers: owner.headers });
    // Close by a shared word, and never one the business already lists.
    expect(d.body.related.length).toBeGreaterThan(0);
    expect(d.body.related.some((c: string) => /dent/i.test(c))).toBe(true);
    expect(d.body.related.filter((c: string) => d.body.categories.includes(c))).toEqual([]);
    const found = await call("GET", `${base(owner)}/categories?q=pest`, { headers: owner.headers });
    expect(found.body.ready).toBe(true);
    expect(found.body.categories[0]).toBe("Pest control service");
    const none = await call("GET", `${base(owner)}/categories?q=zzzz`, { headers: owner.headers });
    expect(none.body).toEqual({ categories: [], ready: true });
    // Catch-all entries in Google's list ("Services", "Store") name no kind of business: never offered.
    const vague = await call("GET", `${base(owner)}/categories?q=s`, { headers: owner.headers });
    expect(vague.body.categories.map((c: string) => c.toLowerCase())).not.toContain("services");
    expect(vague.body.categories.map((c: string) => c.toLowerCase())).not.toContain("store");
  });

  test("cities are Google's places: one name in several states is told apart, and only cities and towns are offered", async () => {
    const spring = await call("GET", `${base(owner)}/locations/${locationId}/cities?q=springfield`, { headers: owner.headers });
    expect(spring.body.ready).toBe(true);
    expect(spring.body.cities.toSorted()).toEqual(["Springfield, IL", "Springfield, MA", "Springfield, MO"]);
    // The business is in Texas: Austin, TX comes before Austin, MN.
    const austin = await call("GET", `${base(owner)}/locations/${locationId}/cities?q=austin`, { headers: owner.headers });
    expect(austin.body.cities.slice(0, 2)).toEqual(["Austin, TX", "Austin, MN"]);
    // Typing the state narrows it; counties, states and postcodes are never offered.
    const narrow = await call("GET", `${base(owner)}/locations/${locationId}/cities?q=springfield mo`, { headers: owner.headers });
    expect(narrow.body.cities).toEqual(["Springfield, MO"]);
    const texas = await call("GET", `${base(owner)}/locations/${locationId}/cities?q=texas`, { headers: owner.headers });
    expect(texas.body.cities.filter((c: string) => /county|^TX$|78701/i.test(c))).toEqual([]);
    // A neighbourhood and a town of the same name in another state stay distinct.
    const hyde = await call("GET", `${base(owner)}/locations/${locationId}/cities?q=hyde park`, { headers: owner.headers });
    expect(hyde.body.cities.toSorted()).toEqual(["Hyde Park, Austin, TX", "Hyde Park, NY"]);
  });

  test("a picked place is searched by the name people type, not its label", async () => {
    const r = await call(
      "GET",
      `${base(owner)}/locations/${locationId}/ideas?categories=${encodeURIComponent("dentist")}&cities=${encodeURIComponent("Austin, TX")}`,
      { headers: owner.headers },
    );
    expect(r.status).toBe(200);
    expect(r.body.organic.every((k: { term: string }) => /austin|near me|dentist/.test(k.term) && !k.term.includes(","))).toBe(true);
  });

  test("ideas follow the categories and cities picked: each category searched in each city", async () => {
    const picked = await call(
      "GET",
      `${base(owner)}/locations/${locationId}/ideas?categories=${encodeURIComponent("cosmetic dentist")}&cities=${encodeURIComponent("round rock|austin")}`,
      { headers: owner.headers },
    );
    expect(picked.status).toBe(200);
    const terms = picked.body.organic.map((k: { term: string }) => k.term);
    expect(terms).toContain("cosmetic dentist round rock");
    expect(terms).toContain("cosmetic dentist austin");
    expect(picked.body.questions[0]).toBe("Who is the best cosmetic dentist in round rock?");
  });

  test("tracks keywords and questions within the Plan, and nothing is checked while it's a draft", async () => {
    const kw = await call("POST", `${base(owner)}/locations/${locationId}/keywords`, {
      headers: owner.headers,
      body: { terms: ["dentist austin", "Teeth Whitening Austin", "dentist austin", "emergency dentist austin"], source: "onboarding" },
    });
    expect(kw.status).toBe(200);
    expect(kw.body.added).toHaveLength(3);
    const qs = await call("POST", `${base(owner)}/locations/${locationId}/questions`, {
      headers: owner.headers,
      body: { texts: ["who is the best dentist in austin", "Where can I get teeth whitening in Austin?"] },
    });
    expect(qs.body.added).toHaveLength(2);
    expect(queued.filter((j) => j.name === CHECK_JOB)).toHaveLength(0);

    const list = await call("GET", `${base(owner)}/locations/${locationId}/keywords`, { headers: owner.headers });
    expect(list.body.map((k: { term: string }) => k.term)).toEqual([
      "dentist austin",
      "teeth whitening austin",
      "emergency dentist austin",
    ]);
    expect(list.body[0].monthlySearches).toBeGreaterThan(0);

    const tooMany = await call("POST", `${base(owner)}/locations/${locationId}/keywords`, {
      headers: owner.headers,
      body: { terms: ["a1 dentist", "a2 dentist", "a3 dentist", "a4 dentist", "a5 dentist", "a6 dentist"] },
    });
    expect(tooMany.status).toBe(402);
  });

  test("checks can't cost more than the Plan allows", async () => {
    const big = await call("PATCH", `${base(owner)}/locations/${locationId}`, { headers: owner.headers, body: { gridSize: 9 } });
    expect(big.status).toBe(402);
    const daily = await call("PATCH", `${base(owner)}/locations/${locationId}`, { headers: owner.headers, body: { checkEvery: "daily" } });
    expect(daily.status).toBe(402);
    const ok = await call("PATCH", `${base(owner)}/locations/${locationId}`, {
      headers: owner.headers,
      body: { gridSize: 5, services: ["Teeth whitening", "Emergency visits"] },
    });
    expect(ok.body).toMatchObject({ gridSize: 5, services: ["Teeth whitening", "Emergency visits"] });
  });
});

describe("launching and the first check", () => {
  let runId = "";
  test("launch makes it active, schedules it and posts every check on the priority queue", async () => {
    const res = await call("POST", `${base(owner)}/locations/${locationId}/launch`, { headers: owner.headers });
    expect(res.status).toBe(200);
    runId = res.body.runId;
    const made = await t.ctx.db.select().from(checks).where(eq(checks.runId, runId));
    expect(made.map((c) => c.kind).sort()).toEqual(["ai", "maps", "organic"]);
    expect(made.every((c) => c.queue === "priority")).toBe(true);
    // 3 keywords × 25 spots; 3 keywords; 2 questions × 3 assistants.
    expect(Object.fromEntries(made.map((c) => [c.kind, c.calls]))).toEqual({ maps: 75, organic: 3, ai: 6 });
    const progress = await call("GET", `${base(owner)}/locations/${locationId}/runs/${runId}`, { headers: owner.headers });
    expect(progress.body.finished).toBe(false);
  });

  test("the worker collects and files every check once, and the Run finishes", async () => {
    await drain();
    const progress = await call("GET", `${base(owner)}/locations/${locationId}/runs/${runId}`, { headers: owner.headers });
    expect(progress.body.finished).toBe(true);
    expect(
      progress.body.checks.every((c: { status: string; calls: number; received: number }) => c.status === "done" && c.received === c.calls),
    ).toBe(true);
    const scans = await t.ctx.db.select().from(mapScans).where(eq(mapScans.locationId, locationId));
    expect(scans).toHaveLength(3);
    const points = await t.ctx.db.select().from(mapPoints).where(eq(mapPoints.scanId, scans[0]!.id));
    expect(points).toHaveLength(25);
    expect(points[0]!.ranking.length).toBeGreaterThan(5);
    // Filing twice does nothing.
    const [maps] = await t.ctx.db
      .select()
      .from(checks)
      .where(and(eq(checks.runId, runId), eq(checks.kind, "maps")));
    await collectCheck(t.ctx, maps!.id);
    expect(await t.ctx.db.select().from(mapScans).where(eq(mapScans.locationId, locationId))).toHaveLength(3);
  });

  test("a keyword is searched only where it's tracked: Google Maps, Google search, or both", async () => {
    const add = await call("POST", `${base(owner)}/locations/${locationId}/keywords`, {
      headers: owner.headers,
      body: { terms: ["dentist prices austin"], maps: false, organic: true },
    });
    expect(add.status).toBe(200);
    const { checkIds } = await startCycle(t.ctx, owner.orgId, locationId, { queue: "standard", scope: { keywordIds: add.body.added } });
    const made = await t.ctx.db.select().from(checks).where(inArray(checks.id, checkIds));
    expect(made.map((c) => [c.kind, c.calls])).toEqual([["organic", 1]]);
    // Asked for on Maps too, it's turned on there, not added twice.
    const widen = await call("POST", `${base(owner)}/locations/${locationId}/keywords`, {
      headers: owner.headers,
      body: { terms: ["dentist prices austin"], maps: true, organic: false },
    });
    expect(widen.body.added).toEqual(add.body.added);
    const [row] = await t.ctx.db.select().from(keywords).where(eq(keywords.id, add.body.added[0]));
    expect(row).toMatchObject({ maps: true, organic: true });
    // Neither isn't a place to search.
    const nowhere = await call("POST", `${base(owner)}/locations/${locationId}/keywords`, {
      headers: owner.headers,
      body: { terms: ["x dentist"], maps: false, organic: false },
    });
    expect(nowhere.status).toBe(422);
    await call("DELETE", `${base(owner)}/locations/${locationId}/keywords/${add.body.added[0]}`, { headers: owner.headers });
    await drain();
  });

  test("Check now checks the kinds asked for, never one that's already running, and reports where each stands", async () => {
    const url = `${base(owner)}/locations/${locationId}`;
    const before = await call("GET", `${url}/checks`, { headers: owner.headers });
    expect(before.status).toBe(200);
    expect(before.body.kinds.every((k: { lastCheckedAt: string | null; running: unknown }) => k.lastCheckedAt && !k.running)).toBe(true);
    expect(before.body).toMatchObject({ keywords: 3, questions: 2, finishing: false });

    const res = await call("POST", `${url}/check`, { headers: owner.headers, body: { kinds: ["organic"] } });
    expect(res.status).toBe(200);
    expect(res.body.kinds).toEqual(["organic"]);
    const made = await t.ctx.db.select().from(checks).where(eq(checks.runId, res.body.runId));
    expect(made.map((c) => c.kind)).toEqual(["organic"]);

    const during = await call("GET", `${url}/checks`, { headers: owner.headers });
    const organic = during.body.kinds.find((k: { kind: string }) => k.kind === "organic");
    expect(organic.running).toMatchObject({ calls: 3 });
    // Asking again for what's running starts nothing; asking for everything starts only the rest.
    expect((await call("POST", `${url}/check`, { headers: owner.headers, body: { kinds: ["organic"] } })).status).toBe(409);
    const rest = await call("POST", `${url}/check`, { headers: owner.headers, body: {} });
    expect(rest.body.kinds).toEqual(["maps", "ai"]);

    await drain();
    const after = await call("GET", `${url}/checks`, { headers: owner.headers });
    expect(after.body.kinds.every((k: { running: unknown }) => !k.running)).toBe(true);
    expect(after.body.finishing).toBe(false);
  });

  test("every business seen joins the shared catalog with today's numbers", async () => {
    const all = await t.ctx.db.select().from(places);
    expect(all.length).toBeGreaterThanOrEqual(10);
    expect(all.find((p) => p.name === "Bright Smile Austin")?.categories).toContain("Emergency dental service");
  });
});

describe("the pages", () => {
  test("overview: one number per check, with usage against the Plan", async () => {
    const o = await call("GET", `${base(owner)}/locations/${locationId}/overview`, { headers: owner.headers });
    expect(o.status).toBe(200);
    expect(o.body.maps).toMatchObject({ spots: 75, keywords: 3 });
    expect(o.body.maps.rows[0].grid).toHaveLength(25);
    expect(o.body.keywords.total).toBe(3);
    expect(o.body.ai).toMatchObject({ total: 6, questions: 2 });
    expect(o.body.competitors.count).toBeGreaterThan(3);
    expect(o.body.usage.keywords).toEqual({ used: 3, limit: 8 });
    expect(o.body.lastCheckedAt).not.toBeNull();
  });

  test("maps: every keyword's grid, and one keyword's board with profile numbers", async () => {
    const m = await call("GET", `${base(owner)}/locations/${locationId}/results/maps`, { headers: owner.headers });
    expect(m.body.keywords).toHaveLength(3);
    expect(m.body.totals.spots).toBe(75);
    const one = await call("GET", `${base(owner)}/locations/${locationId}/results/maps/${m.body.keywords[0].id}`, {
      headers: owner.headers,
    });
    expect(one.body.scan.points).toHaveLength(25);
    expect(one.body.before).toBeNull();
    const you = one.body.board.find((b: { isYou: boolean }) => b.isYou);
    expect(you).toMatchObject({ name: "Maple & Main Dental", rating: 4.7 });
    expect(one.body.board.find((b: { name: string }) => b.name === "Bright Smile Austin").reviews).toBeGreaterThan(500);
    expect(one.body.history.labels).toHaveLength(13);
  });

  test("Google search: positions and the first page with directories marked", async () => {
    const k = await call("GET", `${base(owner)}/locations/${locationId}/results/search`, { headers: owner.headers });
    const row = k.body.keywords[0];
    expect(row.page).toHaveLength(10);
    expect(row.page.some((p: { kind: string }) => p.kind === "directory")).toBe(true);
    expect(row.page.some((p: { kind: string; name: string | null }) => p.kind === "business" && p.name)).toBe(true);
  });

  test("AI answers: per question and assistant, who's named and what's cited", async () => {
    const a = await call("GET", `${base(owner)}/locations/${locationId}/results/ai`, { headers: owner.headers });
    expect(a.body.engines).toEqual(["chatgpt", "google_ai", "perplexity"]);
    const answer = a.body.questions[0].answers.chatgpt;
    expect(answer.named.length).toBeGreaterThan(1);
    expect(answer.cites.length).toBeGreaterThan(0);
    expect(a.body.topCites.length).toBeGreaterThan(0);
  });

  test("competitors: per channel, ahead counts, and hiding one", async () => {
    const c = await call("GET", `${base(owner)}/locations/${locationId}/results/competitors?channel=maps`, { headers: owner.headers });
    expect(c.body.columns).toHaveLength(3);
    const first = c.body.rows[0];
    expect(first.cells).toHaveLength(3);
    const hide = await call("POST", `${base(owner)}/locations/${locationId}/competitors/overrides`, {
      headers: owner.headers,
      body: { action: "hidden", placeId: first.id },
    });
    expect(hide.status).toBe(200);
    const again = await call("GET", `${base(owner)}/locations/${locationId}/results/competitors?channel=maps`, { headers: owner.headers });
    expect(again.body.rows.some((r: { id: string }) => r.id === first.id)).toBe(false);
    expect(again.body.hidden).toEqual([{ overrideId: hide.body.id, placeId: first.id, name: first.name }]);
    await call("DELETE", `${base(owner)}/locations/${locationId}/competitors/overrides/${hide.body.id}`, { headers: owner.headers });
    for (const ch of ["google", "ai"]) {
      const r = await call("GET", `${base(owner)}/locations/${locationId}/results/competitors?channel=${ch}`, { headers: owner.headers });
      expect(r.status).toBe(200);
      expect(r.body.rows.length).toBeGreaterThan(0);
    }
  });
});

describe("suggestions", () => {
  test("are written after the cycle, each with its evidence", async () => {
    const s = await call("GET", `${base(owner)}/locations/${locationId}/suggestions`, { headers: owner.headers });
    const kinds = s.body.open.map((x: { kind: string }) => x.kind);
    expect(kinds).toContain("profile_change"); // categories competitors list
    expect(kinds).toContain("track_question"); // People also ask
    expect(s.body.open.every((x: { evidence: string[] }) => x.evidence.length > 0)).toBe(true);
    // Running the rules again adds nothing new.
    expect(await generateSuggestions(t.ctx, owner.orgId, locationId)).toBe(0);
  });

  test("applying a track suggestion tracks it (and checks it); Undo puts it back", async () => {
    const s = await call("GET", `${base(owner)}/locations/${locationId}/suggestions`, { headers: owner.headers });
    const q = s.body.open.find((x: { kind: string }) => x.kind === "track_question");
    const applied = await call("POST", `${base(owner)}/suggestions/${q.id}/apply`, { headers: owner.headers, body: {} });
    expect(applied.status).toBe(200);
    const qs = await call("GET", `${base(owner)}/locations/${locationId}/questions`, { headers: owner.headers });
    expect(qs.body.map((x: { text: string }) => x.text)).toContain(q.payload.text);
    expect(queued.some((j) => j.name === CHECK_JOB)).toBe(true);
    await drain();

    const after = await call("GET", `${base(owner)}/locations/${locationId}/suggestions`, { headers: owner.headers });
    expect(after.body.done.map((x: { id: string }) => x.id)).toContain(q.id);
    const undo = await call("POST", `${base(owner)}/suggestions/${q.id}/undo`, { headers: owner.headers });
    expect(undo.status).toBe(200);
    const qs2 = await call("GET", `${base(owner)}/locations/${locationId}/questions`, { headers: owner.headers });
    expect(qs2.body.map((x: { text: string }) => x.text)).not.toContain(q.payload.text);
    const back = await call("GET", `${base(owner)}/locations/${locationId}/suggestions`, { headers: owner.headers });
    expect(back.body.open.map((x: { id: string }) => x.id)).toContain(q.id);
  });

  test("a profile change needs the Google profile linked; once linked it applies and undoes", async () => {
    const s = await call("GET", `${base(owner)}/locations/${locationId}/suggestions`, { headers: owner.headers });
    const change = s.body.open.find((x: { kind: string }) => x.kind === "profile_change");
    const refused = await call("POST", `${base(owner)}/suggestions/${change.id}/apply`, { headers: owner.headers, body: {} });
    expect(refused.status).toBe(409);

    // Connect Google (a stub: the app has no OAuth client in tests) and link the profile matched by place.
    const start = await call("POST", `/api/v1/organizations/${owner.orgId}/connections/oauth/google_business`, {
      headers: owner.headers,
      body: { returnTo: "/seo" },
    });
    expect(start.body.url).toBe("/seo?connected=google_business");
    const linked = await call("PUT", `${base(owner)}/locations/${locationId}/profile`, { headers: owner.headers, body: {} });
    expect(linked.body.linked).toBe("accounts/stub/locations/maple-main");

    const ok = await call("POST", `${base(owner)}/suggestions/${change.id}/apply`, { headers: owner.headers, body: {} });
    expect(ok.status).toBe(200);
    const [row] = await t.ctx.db.select().from(suggestions).where(eq(suggestions.id, change.id));
    expect(row!.status).toBe("applied");
    expect((await call("POST", `${base(owner)}/suggestions/${change.id}/undo`, { headers: owner.headers })).status).toBe(200);

    const o = await call("GET", `${base(owner)}/locations/${locationId}/overview`, { headers: owner.headers });
    expect(o.body.profile.calls).toBeGreaterThan(0);
    expect(o.body.location.profileLinked).toBe(true);
  });

  test("with the profile linked, the next cycle suggests a post; its text can be edited before it goes out", async () => {
    await generateSuggestions(t.ctx, owner.orgId, locationId);
    const s = await call("GET", `${base(owner)}/locations/${locationId}/suggestions`, { headers: owner.headers });
    const post = s.body.open.find((x: { kind: string }) => x.kind === "post");
    expect(post).toBeDefined();
    const res = await call("POST", `${base(owner)}/suggestions/${post.id}/apply`, {
      headers: owner.headers,
      body: { text: "Open this Saturday, 8 to 2. Same-day emergency visits too." },
    });
    expect(res.status).toBe(200);
    const [row] = await t.ctx.db.select().from(suggestions).where(eq(suggestions.id, post.id));
    expect(row!.payload).toEqual({ text: "Open this Saturday, 8 to 2. Same-day emergency visits too." });
  });

  test("dismissed suggestions don't come back", async () => {
    const s = await call("GET", `${base(owner)}/locations/${locationId}/suggestions`, { headers: owner.headers });
    const one = s.body.open[0];
    await call("POST", `${base(owner)}/suggestions/${one.id}/dismiss`, { headers: owner.headers });
    await generateSuggestions(t.ctx, owner.orgId, locationId);
    const again = await call("GET", `${base(owner)}/locations/${locationId}/suggestions`, { headers: owner.headers });
    expect(again.body.open.map((x: { id: string }) => x.id)).not.toContain(one.id);
  });
});

describe("the worker's fallback and the costs page", () => {
  test("a check left running with nothing waiting is found and filed", async () => {
    const [c] = await t.ctx.db.select().from(checks).where(eq(checks.locationId, locationId)).limit(1);
    await t.ctx.db
      .update(checks)
      .set({ status: "running", queuedAt: new Date(Date.now() - 10 * 60_000) })
      .where(eq(checks.id, c!.id));
    expect(await dueChecks(t.ctx)).toContain(c!.id);
    await t.ctx.db.update(checks).set({ status: "done" }).where(eq(checks.id, c!.id));
    expect(await dueChecks(t.ctx)).not.toContain(c!.id);
  });

  test("app admins see each Location's monthly cost from what it tracks", async () => {
    const admin = await adminSession(t.ctx);
    const res = await call("GET", "/api/v1/admin/seo/costs", { headers: admin.headers });
    expect(res.status).toBe(200);
    const loc = res.body.locations.find((l: { id: string }) => l.id === locationId);
    const kws = await t.ctx.db
      .select()
      .from(keywords)
      .where(and(eq(keywords.locationId, locationId), eq(keywords.active, true)));
    expect(loc.keywords).toBe(kws.length);
    expect(loc.estimate.total).toBeGreaterThan(0);
    expect(res.body.thisMonth.find((o: { organizationId: string }) => o.organizationId === owner.orgId).costMicros).toBeGreaterThan(0);
    expect((await call("GET", "/api/v1/admin/seo/costs", { headers: owner.headers })).status).toBe(403);
  });
});

describe("who may do what", () => {
  test("a Viewer sees the pages and changes nothing; an Editor tracks and publishes but can't add Locations", async () => {
    const viewer = await userSession(t.ctx);
    await addMember(t.ctx, owner.orgId, viewer.userId, "viewer");
    const v = { ...viewer, orgId: owner.orgId };
    expect((await call("GET", `${base(v)}/locations/${locationId}/overview`, { headers: v.headers })).status).toBe(200);
    expect(
      (await call("POST", `${base(v)}/locations/${locationId}/keywords`, { headers: v.headers, body: { terms: ["x dentist"] } })).status,
    ).toBe(403);
    expect((await call("POST", `${base(v)}/locations/${locationId}/launch`, { headers: v.headers })).status).toBe(403);

    const editor = await userSession(t.ctx);
    await addMember(t.ctx, owner.orgId, editor.userId, "editor");
    const e = { ...editor, orgId: owner.orgId };
    expect(
      (await call("POST", `${base(e)}/locations/${locationId}/keywords`, { headers: e.headers, body: { terms: ["kids dentist austin"] } }))
        .status,
    ).toBe(200);
    expect((await call("POST", `${base(e)}/locations`, { headers: e.headers, body: { name: "X", lat: 1, lng: 1 } })).status).toBe(403);
  });

  test("another Organization can't see or touch this one's Locations", async () => {
    const other = await ownerSession(t.ctx, { orgName: "Other" });
    await assignPlanManually(t.ctx, other.orgId, "local");
    expect((await call("GET", `${base(other)}/locations/${locationId}/overview`, { headers: other.headers })).status).toBe(404);
    expect((await call("GET", `/api/v1/organizations/${owner.orgId}/seo/locations`, { headers: other.headers })).status).toBe(403);
    const [kw] = await t.ctx.db.select().from(keywords).where(eq(keywords.locationId, locationId));
    expect((await call("DELETE", `${base(other)}/locations/${locationId}/keywords/${kw!.id}`, { headers: other.headers })).status).toBe(
      404,
    );
  });

  test("without SEO in the Plan, nothing answers", async () => {
    const other = await ownerSession(t.ctx, { orgName: "No SEO" });
    await upsertPlan(t.ctx, { id: "none", name: "None", entitlements: {}, meters: [] });
    await assignPlanManually(t.ctx, other.orgId, "none");
    expect((await call("GET", `${base(other)}/locations`, { headers: other.headers })).status).toBe(403);
  });

  test("the pingback must carry the check's signature", async () => {
    const [c] = await t.ctx.db.select().from(checks).limit(1);
    expect((await call("GET", `/api/v1/seo/checks/${c!.id}/ready?sig=nope&task=1`)).status).toBe(401);
  });
});

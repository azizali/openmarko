// SEO end to end, in stub mode (the stub market: dental practices around South Congress, Austin): setting up a
// Location, launching it, the worker collecting and filing results, every page's numbers, suggestions with Apply and
// Undo through automation Tasks, and who may do what.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { assignPlanManually, upsertPlan } from "@app/billing";
import { connect } from "@app/integrations";
import { addMember } from "@app/organizations";
import { composedApp, createTestDb, ownerSession, requester, userSession, type Session, type TestDb } from "@app/testkit";
import { collectCheck, COLLECT_JOB, CHECK_JOB, startCycle, generateSuggestions } from "../src";
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
    expect(ideas.body.keywords.length).toBeGreaterThan(3);
    expect(ideas.body.keywords.every((k: { term: string }) => /austin|near me/.test(k.term))).toBe(true);
    expect(ideas.body.questions[0]).toBe("Who is the best dentist in Austin?");
    expect(ideas.body.services.length).toBeGreaterThan(0);
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
    expect(progress.body.checks.every((c: { status: string }) => c.status === "done")).toBe(true);
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
    expect(o.body.checking).toBe(false);
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

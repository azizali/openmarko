// What SEO offers a member's chat (ADR 0036), on the stub market: each read tool answers from the same services as
// the pages, trimmed to a summary, for the Location named, on the page, or the only one.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { callerFor } from "@app/access";
import { assignPlanManually, upsertPlan } from "@app/billing";
import { connect } from "@app/integrations";
import { AppError, toolsOf, type Caller, type ToolCall } from "@app/kernel";
import { composedApp, createTestDb, ownerSession, requester, type Session, type TestDb } from "@app/testkit";
import { collectCheck, COLLECT_JOB, CHECK_JOB, startCycle } from "../src";

let t: TestDb;
let call: ReturnType<typeof requester>;
let owner: Session;
let caller: Caller;
let queued: { name: string; data: Record<string, unknown> }[] = [];
let locationId = "";
const turn: ToolCall = { conversationId: crypto.randomUUID(), page: null };
const base = (s: Session) => `/api/v1/organizations/${s.orgId}/seo`;

const run = (name: string, input: Record<string, unknown> = {}, at: ToolCall = turn) => {
  const tool = toolsOf(t.ctx).find((x) => x.name === name);
  if (!tool) throw new Error(`no tool ${name}`);
  return tool.run(t.ctx, caller, tool.input.parse(input), at) as Promise<Record<string, any>>;
};

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
  caller = await callerFor(t.ctx, owner.headers, owner.orgId);
});
afterAll(() => t.teardown());

describe("SEO tools in a member's chat", () => {
  test("with no business set up, a tool says where setup starts", async () => {
    const err = await run("seo.overview").catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toContain("Search → Overview");
  });

  test("a launched business: overview, rankings, AI answers, competitors and suggestions", async () => {
    const place = (await call("POST", `${base(owner)}/find`, { headers: owner.headers, body: { query: "Maple Main Dental" } })).body[0];
    locationId = (
      await call("POST", `${base(owner)}/locations`, {
        headers: owner.headers,
        body: { place, name: place.name, lat: place.lat, lng: place.lng },
      })
    ).body.id;
    await call("POST", `${base(owner)}/locations/${locationId}/keywords`, {
      headers: owner.headers,
      body: { terms: ["dentist austin", "teeth whitening austin"], source: "onboarding" },
    });
    await call("POST", `${base(owner)}/locations/${locationId}/questions`, {
      headers: owner.headers,
      body: { texts: ["who is the best dentist in austin"] },
    });
    expect((await call("POST", `${base(owner)}/locations/${locationId}/launch`, { headers: owner.headers })).status).toBe(200);
    await drain();

    expect((await run("seo.list_locations")) as unknown).toEqual([
      expect.objectContaining({ id: locationId, name: "Maple & Main Dental" }),
    ]);

    const o = await run("seo.overview");
    expect(o.business.name).toBe("Maple & Main Dental");
    expect(o.googleMaps.spots).toBeGreaterThan(0);
    expect(o.googleMaps.top3Share).toMatch(/%$/);

    const maps = await run("seo.maps_rankings");
    expect(maps.keywords.length).toBeGreaterThan(0);
    expect(maps.keywords[0]).toHaveProperty("top3Spots");

    const detail = await run("seo.maps_keyword", { keyword: maps.keywords[0].keyword });
    expect(detail.board.length).toBeGreaterThan(1);
    expect(detail.board.length).toBeLessThanOrEqual(10);

    const search = await run("seo.search_rankings");
    expect(search.keywords[0]).toHaveProperty("searchesPerMonth");

    const ai = await run("seo.ai_answers");
    expect(ai.questions[0].question).toBe("Who is the best dentist in austin?"); // stored as a question

    for (const channel of ["maps", "google", "ai"]) expect(await run("seo.competitors", { channel })).toHaveProperty("competitors");
    const plan = await run("seo.suggestions");
    const fix = plan.open.find((x: { from: string }) => x.from === "audit");
    expect(fix).toMatchObject({ kind: "site_fix", doneByHand: true });
    expect(Array.isArray(fix.improves)).toBe(true);

    const audit = await run("seo.site_audit");
    expect(audit.health).toBeGreaterThan(0);
    const schema = audit.issues.find((i: { code: string }) => i.code === "no_local_schema");
    expect(schema).toMatchObject({ severity: "error", inActionPlan: "open" });
    const issue = await run("seo.site_audit_issue", { code: "no_local_schema" });
    expect(issue.paste.text).toContain("Maple & Main Dental");

    // Summaries, not pages: each answer stays small enough to send to a model many times a turn.
    for (const [name, out] of Object.entries({ o, maps, detail, search, ai, plan, audit, issue })) {
      const size = JSON.stringify(out).length;
      if (process.env.SHOW_SIZES) console.log(name, size);
      expect(size).toBeLessThan(8000);
    }
  });

  test("a keyword that isn't tracked is named back with the ones that are", async () => {
    const err = await run("seo.maps_keyword", { keyword: "plumber" }).catch((e) => e);
    expect(err.message).toContain("isn't a tracked Maps keyword");
  });

  test("with two businesses, the one on the member's page is used, else the model is asked which", async () => {
    const place = (await call("POST", `${base(owner)}/find`, { headers: owner.headers, body: { query: "Smile Co" } })).body[0];
    const second = (
      await call("POST", `${base(owner)}/locations`, {
        headers: owner.headers,
        body: { place, name: "Second Office", lat: place.lat, lng: place.lng },
      })
    ).body.id;
    const which = await run("seo.overview").catch((e) => e);
    expect(which.code).toBe("which_location");
    expect(which.message).toContain("Second Office");
    const onPage = await run("seo.overview", {}, { ...turn, page: { path: "/seo/overview", params: { location: second } } });
    expect(onPage.business.name).toBe("Second Office");
    expect((await run("seo.overview", { location: "maple" })).business.id).toBe(locationId);
  });
});

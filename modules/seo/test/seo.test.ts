import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createTestDb, ownerSession, type TestDb, type Session } from "@openmarko/testkit";
import { AppError, drainOutbox, emit, outbox } from "@openmarko/kernel";
import { assignPlanManually, upsertPlan } from "@openmarko/billing";
import { compose } from "@openmarko/platform";
import { createLocation, addWebsite, listLocations } from "@openmarko/organizations";
import { applyTask, listTasks, revertTask, proposeTask } from "@openmarko/automation";
import {
  connectProfile,
  syncProfile,
  scanRankings,
  addKeyword,
  checkAnswers,
  addQuestion,
  runAudit,
  checkCitations,
  draftArticle,
  publishArticle,
  proposeReviewReply,
  listReviews,
  listKeywords,
  listSnapshots,
  listAnswers,
  listAudits,
  listCitations,
  listArticles,
} from "../src";
import { rankSnapshots } from "../src/schema";
import { seoJobs } from "../src/jobs";
import { connect } from "@openmarko/integrations";

const PLAN = {
  id: "full",
  name: "Full",
  entitlements: {
    "feature.seo": 1,
    "feature.rankings": 1,
    "feature.ai_answers": 1,
    "feature.reviews": 1,
    "feature.site_health": 1,
    "feature.citations": 1,
    "feature.content": 1,
  },
  meters: [
    { meter: "dataforseo.request", included: null, overage: "charge" as const, unitPriceMicros: 0 },
    { meter: "llm.tokens", included: null, overage: "charge" as const, unitPriceMicros: 0 },
  ],
};

let t: TestDb;
let owner: Session;
const queued: { name: string; data: Record<string, unknown> }[] = [];

beforeAll(async () => {
  t = await createTestDb();
  compose(t.ctx); // registers the seo handlers and task executors, as the real process does
  t.ctx.enqueue = async (name, data) => {
    queued.push({ name, data });
  };
  // The providers the SEO features need: DataForSEO for search data, and the platform default for model calls.
  await connect(t.ctx, {
    organizationId: null,
    providerId: "platform_llm",
    target: { type: "platform", id: null },
    label: "Platform default",
    secrets: { apiKey: "k", vendor: "anthropic" },
  });
  owner = await ownerSession(t.ctx, { orgName: "Maple & Main Dental" });
  await connect(t.ctx, {
    organizationId: owner.orgId,
    providerId: "dataforseo",
    target: { type: "organization", id: owner.orgId },
    label: "DataForSEO",
    secrets: { login: "u", password: "p" },
  });
  await upsertPlan(t.ctx, PLAN);
  await assignPlanManually(t.ctx, owner.orgId, "full");
});
afterAll(() => t.teardown());

const actor = {
  get orgId() {
    return owner.orgId;
  },
  get userId() {
    return owner.userId;
  },
};

async function locationWithProfile(name = "South Congress") {
  const id = await createLocation(
    t.ctx,
    { orgId: owner.orgId, userId: owner.userId },
    { name, city: "Austin", websiteUrl: "https://mapleandmain.com/implants" },
  );
  await connectProfile(t.ctx, actor, id, { gbpId: `locations/${crypto.randomUUID().slice(0, 8)}`, label: name });
  return id;
}

describe("Business Profile: connected per Location, and synced (ADR 0011)", () => {
  test("connecting a Google Business Profile sets it on the Location; a second connect is refused", async () => {
    const loc = await createLocation(t.ctx, { orgId: owner.orgId, userId: owner.userId }, { name: "Mueller" });
    await connectProfile(t.ctx, actor, loc, { gbpId: "locations/mueller-1", label: "Mueller" });
    const row = (await listLocations(t.ctx, owner.orgId)).find((l) => l.id === loc)!;
    expect(row.gbpId).toBe("locations/mueller-1");
    await expect(connectProfile(t.ctx, actor, loc, { gbpId: "locations/mueller-2", label: "x" })).rejects.toMatchObject({ status: 409 });
  });

  test("a Location without a profile can't sync: it's inert and says Connect", async () => {
    const loc = await createLocation(t.ctx, { orgId: owner.orgId, userId: owner.userId }, { name: "Pending" });
    await expect(syncProfile(t.ctx, owner.orgId, loc)).rejects.toMatchObject({ status: 409 });
  });

  test("a sync stores new reviews once, and emits review.received for each new one", async () => {
    const loc = await locationWithProfile("Sync test");
    const first = await syncProfile(t.ctx, owner.orgId, loc);
    expect(first.newReviews).toBeGreaterThan(0);
    const second = await syncProfile(t.ctx, owner.orgId, loc);
    expect(second.newReviews).toBe(0);
    const events = await t.ctx.db.select().from(outbox).where(eq(outbox.event, "review.received"));
    expect(events.length).toBeGreaterThanOrEqual(first.newReviews);
  });

  test("a low-rated review queues a reply draft, and a normal one doesn't", async () => {
    queued.length = 0;
    await t.ctx.db.transaction((tx) =>
      emit(tx, { event: "review.received", organizationId: owner.orgId, payload: { reviewId: "r-low", rating: 1 } }),
    );
    await t.ctx.db.transaction((tx) =>
      emit(tx, { event: "review.received", organizationId: owner.orgId, payload: { reviewId: "r-ok", rating: 5 } }),
    );
    await drainOutbox(t.ctx.db);
    const drafts = queued.filter((q) => q.name === "seo.review-reply-draft");
    // The earlier sync brings in a 2-star stub review too, so check membership rather than the whole list.
    const ids = drafts.map((d) => d.data.reviewId);
    expect(ids).toContain("r-low");
    expect(ids).not.toContain("r-ok");
  });
});

describe("reviews: a reply is a Task; Undo puts the old reply back (ADR 0005)", () => {
  test("draft → apply posts the reply on Google and records it; Undo restores the previous one", async () => {
    const loc = await locationWithProfile("Reply test");
    await syncProfile(t.ctx, owner.orgId, loc);
    const [review] = await listReviews(t.ctx, owner.orgId, loc);
    const { id, applied } = await proposeReviewReply(t.ctx, owner.orgId, review!.id, { userId: owner.userId, type: "member" });
    expect(applied).toBe(false);
    await applyTask(t.ctx, { organizationId: owner.orgId, userId: owner.userId, actorType: "member" }, id);
    const after = (await listReviews(t.ctx, owner.orgId, loc)).find((r) => r.id === review!.id);
    expect(after!.reply).toBeTruthy();
    await revertTask(t.ctx, { organizationId: owner.orgId, userId: owner.userId, actorType: "member" }, id);
    const undone = (await listReviews(t.ctx, owner.orgId, loc)).find((r) => r.id === review!.id);
    expect(undone!.reply ?? "").toBe("");
  });
});

describe("Business Profile edits are Tasks that call Google", () => {
  test("a profile_edit task applies and undoes through the Business Profile connection", async () => {
    const loc = await locationWithProfile("Edit test");
    const r = await proposeTask(t.ctx, {
      organizationId: owner.orgId,
      kind: "profile_edit",
      featureId: "seo",
      action: "seo.publish",
      title: "Hours",
      payload: { locationId: loc, field: "regularHours", value: "Mon-Fri 9-5", previous: "Mon-Fri 8-4" },
      createdByType: "member",
      createdBy: owner.userId,
    });
    await applyTask(t.ctx, { organizationId: owner.orgId, userId: owner.userId, actorType: "member" }, r.id);
    await revertTask(t.ctx, { organizationId: owner.orgId, userId: owner.userId, actorType: "member" }, r.id);
    expect((await listTasks(t.ctx, owner.orgId, "reverted")).some((x) => x.id === r.id)).toBe(true);
  });
});

describe("rankings, AI answers, audits, citations, articles", () => {
  test("a keyword scan stores one snapshot per keyword, organic and local-pack", async () => {
    const loc = await createLocation(t.ctx, { orgId: owner.orgId, userId: owner.userId }, { name: "Rankings Loc" });
    await addWebsite(t.ctx, actor, "mapleandmain.com");
    const kw = await addKeyword(t.ctx, owner.orgId, loc, "Dentist Austin");
    await addKeyword(t.ctx, owner.orgId, loc, "emergency dentist");
    expect((await listKeywords(t.ctx, owner.orgId, loc)).length).toBe(2);
    const { checked } = await scanRankings(t.ctx, owner.orgId, loc);
    expect(checked).toBe(2);
    const snaps = await listSnapshots(t.ctx, owner.orgId, kw);
    expect(snaps.length).toBe(1);
    expect(snaps[0]!.organicRank === null || typeof snaps[0]!.organicRank === "number").toBe(true);
  });

  test("AI answers: each question is asked and the answer records whether we're listed", async () => {
    const loc = await createLocation(t.ctx, { orgId: owner.orgId, userId: owner.userId }, { name: "AI Loc" });
    const q = await addQuestion(t.ctx, owner.orgId, loc, "best dentist in South Austin?");
    const res = await checkAnswers(t.ctx, owner.orgId, loc);
    expect(res.answers).toBe(1);
    const answers = await listAnswers(t.ctx, owner.orgId, q);
    expect(answers.length).toBe(1);
    expect(answers[0]!.listed).toBeArray();
  });

  test("a site audit crawls the domain and stores its issues", async () => {
    const site = await addWebsite(t.ctx, actor, "audit.mapleandmain.test");
    await runAudit(t.ctx, owner.orgId, site);
    const rows = await listAudits(t.ctx, owner.orgId, site);
    expect(rows.length).toBe(1);
    expect(rows[0]!.pagesCrawled).toBeGreaterThan(0);
    expect(rows[0]!.issues.length).toBeGreaterThan(0);
  });

  test("citations: one row per directory, found or missing", async () => {
    const loc = await createLocation(t.ctx, { orgId: owner.orgId, userId: owner.userId }, { name: "Citations Loc" });
    await checkCitations(t.ctx, owner.orgId, loc);
    const rows = await listCitations(t.ctx, owner.orgId, loc);
    expect(rows.length).toBe(6);
    expect(rows.every((r) => r.status === "found" || r.status === "missing")).toBe(true);
  });

  test("articles: a draft is stored; publishing needs a website connection and says Connect", async () => {
    const site = await addWebsite(t.ctx, actor, "articles.mapleandmain.test");
    const id = await draftArticle(t.ctx, owner.orgId, site, "dental implants austin", owner.userId);
    const [a] = await listArticles(t.ctx, owner.orgId, site);
    expect(a!.status).toBe("draft");
    const err = await publishArticle(t.ctx, owner.orgId, id).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(409);
    expect(err.details).toEqual({ needs: "site.write" });
  });
});

describe("the feature switch stops its jobs (ADR 0006)", () => {
  test("a job for a feature the Plan doesn't include does nothing", async () => {
    const other = await ownerSession(t.ctx, { orgName: "Bare plan" });
    await upsertPlan(t.ctx, { id: "no-rankings", name: "No rankings", entitlements: { "feature.seo": 1 } });
    await assignPlanManually(t.ctx, other.orgId, "no-rankings");
    const loc = await createLocation(t.ctx, { orgId: other.orgId, userId: other.userId }, { name: "Off" });
    await addKeyword(t.ctx, other.orgId, loc, "anything");
    const job = seoJobs(t.ctx).find((j) => j.name === "seo.rank-scan")!;
    await job.run({ organizationId: other.orgId, targetId: loc }, { enqueue: async () => {} });
    const rows = await t.ctx.db.select().from(rankSnapshots).where(eq(rankSnapshots.organizationId, other.orgId));
    expect(rows.length).toBe(0);
  });
});

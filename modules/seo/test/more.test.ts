import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createTestDb, ownerSession, type TestDb, type Session } from "@openmarko/testkit";
import { AppError } from "@openmarko/kernel";
import { assignPlanManually, upsertPlan, usageEvents } from "@openmarko/billing";
import { compose } from "@openmarko/platform";
import { addWebsite, createLocation } from "@openmarko/organizations";
import { connect } from "@openmarko/integrations";
import { applyTask, listTasks, revertTask } from "@openmarko/automation";
import {
  scanGrid,
  listGridScans,
  gridPointsAround,
  sendReviewRequest,
  checkBacklinks,
  listBacklinks,
  runAudit,
  listAudits,
  proposeSiteFix,
} from "../src";
import { backlinks } from "../src/schema";

let t: TestDb;
let owner: Session;

beforeAll(async () => {
  t = await createTestDb();
  compose(t.ctx);
  t.ctx.enqueue = async () => {};
  await connect(t.ctx, {
    organizationId: null,
    providerId: "platform_llm",
    target: { type: "platform", id: null },
    label: "Platform",
    secrets: { apiKey: "k", vendor: "anthropic" },
  });
  owner = await ownerSession(t.ctx, { orgName: "Maple & Main" });
  await connect(t.ctx, {
    organizationId: owner.orgId,
    providerId: "dataforseo",
    target: { type: "organization", id: owner.orgId },
    label: "DFS",
    secrets: { login: "u", password: "p" },
  });
  await upsertPlan(t.ctx, {
    id: "everything",
    name: "Everything",
    entitlements: {
      "feature.seo": 1,
      "feature.rankings": 1,
      "feature.reviews": 1,
      "feature.citations": 1,
      "feature.site_health": 1,
      "feature.content": 1,
    },
    meters: [
      { meter: "dataforseo.request", included: null, overage: "charge", unitPriceMicros: 0 },
      { meter: "llm.tokens", included: null, overage: "charge", unitPriceMicros: 0 },
      { meter: "email.sent", included: null, overage: "charge", unitPriceMicros: 0 },
    ],
  });
  await assignPlanManually(t.ctx, owner.orgId, "everything");
});
afterAll(() => t.teardown());

const who = () => ({ orgId: owner.orgId, userId: owner.userId });

describe("grid scans (rankings)", () => {
  test("the grid is centred on the Location and spaced by the step", () => {
    const pts = gridPointsAround(30.25, -97.75, 3, 1);
    expect(pts.length).toBe(9);
    const centre = pts.find((p) => p.row === 1 && p.col === 1)!;
    expect(centre.lat).toBeCloseTo(30.25, 5);
    expect(centre.lng).toBeCloseTo(-97.75, 5);
    const north = pts.find((p) => p.row === 0 && p.col === 1)!;
    expect(north.lat).toBeGreaterThan(centre.lat);
  });

  test("a scan checks every point and stores a rank (or none) for each", async () => {
    const loc = await createLocation(t.ctx, who(), { name: "South Congress", lat: 30.25, lng: -97.75 });
    const scanId = await scanGrid(t.ctx, owner.orgId, loc, "dentist austin", { size: 3, stepKm: 0.5 });
    const scan = (await listGridScans(t.ctx, owner.orgId, loc)).find((s) => s.id === scanId);
    expect(scan!.points.length).toBe(9);
  });

  test("a Location without coordinates can't be scanned", async () => {
    const loc = await createLocation(t.ctx, who(), { name: "No coords" });
    await expect(scanGrid(t.ctx, owner.orgId, loc, "x y")).rejects.toBeInstanceOf(AppError);
  });
});

describe("review requests (sent by email, metered)", () => {
  test("a Location with no Place ID has no review link, so nothing is sent", async () => {
    const loc = await createLocation(t.ctx, who(), { name: "No place" });
    await expect(sendReviewRequest(t.ctx, owner.orgId, loc, { email: "pat@example.test" }, owner.userId)).rejects.toMatchObject({
      status: 422,
    });
  });

  test("without a sending connection the request says Connect", async () => {
    const loc = await createLocation(t.ctx, who(), { name: "Sender", placeId: "ChIJ123" });
    await expect(sendReviewRequest(t.ctx, owner.orgId, loc, { email: "pat@example.test" }, owner.userId)).rejects.toMatchObject({
      status: 409,
      details: { needs: "email.send" },
    });
  });

  test("with email connected, the request is sent and metered", async () => {
    await connect(t.ctx, {
      organizationId: owner.orgId,
      providerId: "managed_email",
      target: { type: "organization", id: owner.orgId },
      label: "Managed sending",
    });
    const loc = await createLocation(t.ctx, who(), { name: "Sent", placeId: "ChIJ456" });
    await sendReviewRequest(t.ctx, owner.orgId, loc, { email: "pat@example.test", name: "Pat" }, owner.userId);
    const rows = await t.ctx.db.select().from(usageEvents).where(eq(usageEvents.meter, "email.sent"));
    expect(rows.some((r) => r.organizationId === owner.orgId)).toBe(true);
  });
});

describe("backlinks: new links appear, and links that stop appearing are marked lost", () => {
  test("a check adds the referring domains; a repeat adds none", async () => {
    const site = await addWebsite(t.ctx, who(), "links.mapleandmain.test");
    const first = await checkBacklinks(t.ctx, owner.orgId, site);
    expect(first.added).toBe(2);
    const second = await checkBacklinks(t.ctx, owner.orgId, site);
    expect(second.added).toBe(0);
    expect((await listBacklinks(t.ctx, owner.orgId, site)).length).toBe(2);
  });

  test("a link that no longer appears is marked lost, and kept for history", async () => {
    const site = await addWebsite(t.ctx, who(), "gone-links.mapleandmain.test");
    const { newId } = await import("@openmarko/kernel");
    await t.ctx.db.insert(backlinks).values({
      id: newId(),
      organizationId: owner.orgId,
      websiteId: site,
      sourceDomain: "old-partner.test",
      url: "https://old-partner.test/x",
    });
    const r = await checkBacklinks(t.ctx, owner.orgId, site);
    expect(r.lost).toBe(1);
    const rows = await listBacklinks(t.ctx, owner.orgId, site);
    expect(rows.find((x) => x.sourceDomain === "old-partner.test")!.lostAt).not.toBeNull();
  });
});

describe("site fixes: an audit issue becomes a Task that writes through the website's CMS", () => {
  test("no CMS connected: applying the fix says Connect", async () => {
    const site = await addWebsite(t.ctx, who(), "fix-me.mapleandmain.test");
    await runAudit(t.ctx, owner.orgId, site);
    const [audit] = await listAudits(t.ctx, owner.orgId, site);
    const issue = audit!.issues.find((i) => i.rule === "title.missing")!;
    const r = await proposeSiteFix(t.ctx, owner.orgId, issue.id, owner.userId);
    await expect(applyTask(t.ctx, { organizationId: owner.orgId, userId: owner.userId, actorType: "member" }, r.id)).rejects.toMatchObject({
      status: 409,
      details: { needs: "site.write" },
    });
  });

  test("with WordPress connected to the website, apply writes the title and Undo puts the old one back", async () => {
    const site = await addWebsite(t.ctx, who(), "wp.mapleandmain.test");
    await connect(t.ctx, {
      organizationId: owner.orgId,
      providerId: "wordpress",
      target: { type: "website", id: site },
      externalId: "https://wp.mapleandmain.test",
      label: "WordPress",
      secrets: { username: "u", appPassword: "p" },
    });
    await runAudit(t.ctx, owner.orgId, site);
    const [audit] = await listAudits(t.ctx, owner.orgId, site);
    const issue = audit!.issues.find((i) => i.rule === "title.missing")!;
    const r = await proposeSiteFix(t.ctx, owner.orgId, issue.id, owner.userId);
    await applyTask(t.ctx, { organizationId: owner.orgId, userId: owner.userId, actorType: "member" }, r.id);
    expect((await listTasks(t.ctx, owner.orgId, "applied")).some((x) => x.id === r.id)).toBe(true);
    await revertTask(t.ctx, { organizationId: owner.orgId, userId: owner.userId, actorType: "member" }, r.id);
    const task = (await listTasks(t.ctx, owner.orgId, "reverted")).find((x) => x.id === r.id);
    expect(task!.revert).toMatchObject({ previous: "Old title" });
  });

  test("an audit rule with no automatic fix is refused", async () => {
    const site = await addWebsite(t.ctx, who(), "nofix.mapleandmain.test");
    await runAudit(t.ctx, owner.orgId, site);
    const [audit] = await listAudits(t.ctx, owner.orgId, site);
    const fake = audit!.issues[0]!;
    // Re-label the rule so it has no fix (the stub's real rules all have fixes).
    const { auditIssues } = await import("../src/schema");
    await t.ctx.db.update(auditIssues).set({ rule: "https.missing" }).where(eq(auditIssues.id, fake.id));
    await expect(proposeSiteFix(t.ctx, owner.orgId, fake.id, owner.userId)).rejects.toMatchObject({ status: 422 });
  });
});

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { createTestDb, ownerSession, type TestDb, type Session } from "@openmarko/testkit";
import { AppError, authMember, authOrganization } from "@openmarko/kernel";
import { assignPlanManually, upsertPlan } from "@openmarko/billing";
import {
  addMember,
  requestClient,
  respondToPartnerRequest,
  archiveOrganization,
  createLocation,
  addWebsite,
  hardDeleteOrganization,
  listLocations,
  onOrganizationDelete,
  transferOut,
  transferOutPreview,
} from "../src";
import { locations, websites } from "../src/schema";

let t: TestDb;
let owner: Session;

beforeAll(async () => {
  t = await createTestDb();
  owner = await ownerSession(t.ctx);
  await upsertPlan(t.ctx, { id: "local", name: "Local", entitlements: { "limit.locations": 2 } });
  await assignPlanManually(t.ctx, owner.orgId, "local");
});
afterAll(() => t.teardown());

const actor = (s: Session) => ({ orgId: s.orgId, userId: s.userId });

describe("Locations and Websites are independent (ADR 0011)", () => {
  test("a Location is limited by the Plan, and archiving frees a place", async () => {
    await createLocation(t.ctx, actor(owner), { name: "South Congress" });
    await createLocation(t.ctx, actor(owner), { name: "Mueller" });
    await expect(createLocation(t.ctx, actor(owner), { name: "Third" })).rejects.toMatchObject({ status: 402 });
    const [loc] = await listLocations(t.ctx, owner.orgId);
    const { archiveLocation } = await import("../src");
    await archiveLocation(t.ctx, actor(owner), loc!.id);
    await createLocation(t.ctx, actor(owner), { name: "Replacement" });
  });

  test("an Organization can have a Website and no Location", async () => {
    const bare = await ownerSession(t.ctx, { orgName: "Website only" });
    await addWebsite(t.ctx, actor(bare), "https://www.Example-Clinic.com/");
    const rows = await t.ctx.db.select().from(websites).where(eq(websites.organizationId, bare.orgId));
    expect(rows.map((r) => r.domain)).toEqual(["example-clinic.com"]);
    expect((await listLocations(t.ctx, bare.orgId)).length).toBe(0);
  });
});

describe("Partner and Clients: transfer out with per-person revoke (ADR 0011)", () => {
  test("a Partner can attach a Client; the Client's agency members show in the preview", async () => {
    const partner = await ownerSession(t.ctx, { orgName: "Brightline Local" });
    await upsertPlan(t.ctx, { id: "agency", name: "Agency", entitlements: { partner: 1 } });
    await assignPlanManually(t.ctx, partner.orgId, "agency");
    const client = await ownerSession(t.ctx, { orgName: "Hill Country Plumbing" });
    const reqId = await requestClient(t.ctx, actor(partner), client.orgId);
    await respondToPartnerRequest(t.ctx, actor(client), reqId, true);

    // An agency person who works on the Client.
    const agent = await ownerSession(t.ctx, { orgName: "Agency staff" });
    await addMember(t.ctx, partner.orgId, agent.userId, "admin");
    await addMember(t.ctx, client.orgId, agent.userId, "editor");

    const preview = await transferOutPreview(t.ctx, client.orgId);
    expect(preview.partnerId).toBe(partner.orgId);
    expect(preview.members.map((m) => m.userId)).toContain(agent.userId);

    await transferOut(t.ctx, actor(client), client.orgId, [agent.userId]);
    const [org] = await t.ctx.db.select().from(authOrganization).where(eq(authOrganization.id, client.orgId));
    expect(org!.partnerId).toBeNull();
    const left = await t.ctx.db
      .select()
      .from(authMember)
      .where(and(eq(authMember.organizationId, client.orgId), eq(authMember.userId, agent.userId)));
    expect(left.length).toBe(0);
  });

  test("transfer out refuses to revoke someone who isn't an agency member", async () => {
    const partner = await ownerSession(t.ctx, { orgName: "P2" });
    await upsertPlan(t.ctx, { id: "agency", name: "Agency", entitlements: { partner: 1 } });
    await assignPlanManually(t.ctx, partner.orgId, "agency");
    const client = await ownerSession(t.ctx, { orgName: "C2" });
    await respondToPartnerRequest(t.ctx, actor(client), await requestClient(t.ctx, actor(partner), client.orgId), true);
    await expect(transferOut(t.ctx, actor(client), client.orgId, [crypto.randomUUID()])).rejects.toMatchObject({ status: 422 });
  });

  test("nothing changes until the Client's owner accepts; declining leaves the Client alone", async () => {
    const partner = await ownerSession(t.ctx, { orgName: "P3" });
    await upsertPlan(t.ctx, { id: "agency", name: "Agency", entitlements: { partner: 1 } });
    await assignPlanManually(t.ctx, partner.orgId, "agency");
    const client = await ownerSession(t.ctx, { orgName: "C3" });
    const reqId = await requestClient(t.ctx, actor(partner), client.orgId);
    await expect(requestClient(t.ctx, actor(partner), client.orgId)).rejects.toMatchObject({ status: 409 });
    const [before] = await t.ctx.db.select().from(authOrganization).where(eq(authOrganization.id, client.orgId));
    expect(before!.partnerId).toBeNull();
    await respondToPartnerRequest(t.ctx, actor(client), reqId, false);
    const [after] = await t.ctx.db.select().from(authOrganization).where(eq(authOrganization.id, client.orgId));
    expect(after!.partnerId).toBeNull();
    await expect(respondToPartnerRequest(t.ctx, actor(client), reqId, true)).rejects.toMatchObject({ status: 409 });
  });

  test("a Client can't have two Partners at once", async () => {
    const partner = await ownerSession(t.ctx, { orgName: "P4" });
    const other = await ownerSession(t.ctx, { orgName: "P5" });
    await upsertPlan(t.ctx, { id: "agency", name: "Agency", entitlements: { partner: 1 } });
    await assignPlanManually(t.ctx, partner.orgId, "agency");
    await assignPlanManually(t.ctx, other.orgId, "agency");
    const client = await ownerSession(t.ctx, { orgName: "C4" });
    await respondToPartnerRequest(t.ctx, actor(client), await requestClient(t.ctx, actor(partner), client.orgId), true);
    await expect(requestClient(t.ctx, actor(other), client.orgId)).rejects.toMatchObject({ status: 409 });
  });

  test("a host resolves to the Partner whose brand it shows", async () => {
    const { addDomain, partnerForHost } = await import("../src");
    const partner = await ownerSession(t.ctx, { orgName: "Brightline Local" });
    await upsertPlan(t.ctx, { id: "agency", name: "Agency", entitlements: { partner: 1 } });
    await assignPlanManually(t.ctx, partner.orgId, "agency");
    await addDomain(t.ctx, actor(partner), "marketing.brightlinelocal.test:3000");
    expect(await partnerForHost(t.ctx, "marketing.brightlinelocal.test")).toBe(partner.orgId);
    expect(await partnerForHost(t.ctx, "app.openmarko.test")).toBeNull();
  });
});

describe("archive and hard delete (schema.md)", () => {
  test("archiving hides the Organization from its members", async () => {
    const s = await ownerSession(t.ctx, { orgName: "Closing" });
    await archiveOrganization(t.ctx, actor(s), true);
    const [org] = await t.ctx.db.select().from(authOrganization).where(eq(authOrganization.id, s.orgId));
    expect(org!.archivedAt).not.toBeNull();
  });

  test("hard delete needs the Organization archived first, then removes every tenant row", async () => {
    const s = await ownerSession(t.ctx, { orgName: "Gone" });
    await createLocation(t.ctx, actor(s), { name: "Only" });
    await addWebsite(t.ctx, actor(s), "gone.example.com");
    await expect(hardDeleteOrganization(t.ctx, actor(s))).rejects.toBeInstanceOf(AppError);

    let hookRan = false;
    onOrganizationDelete({
      name: "test.delete-hook",
      run: async () => {
        hookRan = true;
      },
    });
    await archiveOrganization(t.ctx, actor(s), true);
    await hardDeleteOrganization(t.ctx, actor(s));
    expect(hookRan).toBe(true);
    expect((await t.ctx.db.select().from(locations).where(eq(locations.organizationId, s.orgId))).length).toBe(0);
    expect((await t.ctx.db.select().from(websites).where(eq(websites.organizationId, s.orgId))).length).toBe(0);
    expect((await t.ctx.db.select().from(authOrganization).where(eq(authOrganization.id, s.orgId))).length).toBe(0);
  });
});

describe("whitelabel brand (ADR 0004)", () => {
  test("a Partner's brand comes from its settings; an unbranded host gets the default", async () => {
    const { brandFor, setBrand, defaultBrand } = await import("../src");
    const partner = await ownerSession(t.ctx, { orgName: "Brand Partner" });
    expect(await brandFor(t.ctx, null)).toEqual(defaultBrand);
    await setBrand(t.ctx, partner.orgId, { name: "Brightline Local", assistant: "Bright", accent: "#0a7d6e", logo: null }, partner.userId);
    expect((await brandFor(t.ctx, partner.orgId)).name).toBe("Brightline Local");
  });

  test("an invalid brand is refused before it's stored", async () => {
    const { setBrand } = await import("../src");
    const partner = await ownerSession(t.ctx, { orgName: "Bad Brand" });
    await expect(setBrand(t.ctx, partner.orgId, { name: "x", accent: "red" }, partner.userId)).rejects.toMatchObject({ status: 422 });
  });
});

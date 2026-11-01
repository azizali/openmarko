import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createTestDb, ownerSession, type TestDb, type Session } from "@openmarko/testkit";
import { assignPlanManually, upsertPlan } from "@openmarko/billing";
import { compose } from "@openmarko/platform";
import { addWebsite } from "@openmarko/organizations";
import { connect } from "@openmarko/integrations";
import { draftArticle, listArticles, listAudits, proposeSiteFix, publishArticle, runAudit } from "../src";

let t: TestDb;
let owner: Session;

beforeAll(async () => {
  t = await createTestDb();
  compose(t.ctx);
  await connect(t.ctx, {
    organizationId: null,
    providerId: "platform_llm",
    target: { type: "platform", id: null },
    label: "Platform",
    secrets: { apiKey: "k", vendor: "anthropic" },
  });
  owner = await ownerSession(t.ctx, { orgName: "CMS org" });
  await connect(t.ctx, {
    organizationId: owner.orgId,
    providerId: "dataforseo",
    target: { type: "organization", id: owner.orgId },
    label: "DFS",
    secrets: { login: "u", password: "p" },
  });
  await upsertPlan(t.ctx, {
    id: "cms",
    name: "CMS",
    entitlements: { "feature.seo": 1, "feature.site_health": 1, "feature.content": 1 },
    meters: [
      { meter: "dataforseo.request", included: null, overage: "charge", unitPriceMicros: 0 },
      { meter: "llm.tokens", included: null, overage: "charge", unitPriceMicros: 0 },
    ],
  });
  await assignPlanManually(t.ctx, owner.orgId, "cms");
});
afterAll(() => t.teardown());

const who = () => ({ orgId: owner.orgId, userId: owner.userId });
const connectCms = (
  websiteId: string,
  providerId: "wordpress" | "webflow" | "shopify" | "ghost" | "custom_site",
  settings: Record<string, string> = {},
) =>
  connect(t.ctx, {
    organizationId: owner.orgId,
    providerId,
    target: { type: "website", id: websiteId },
    label: providerId,
    settings,
    secrets: { token: "x" },
  });

describe("websites connect through any CMS (ADR 0016)", () => {
  for (const cms of ["webflow", "shopify", "ghost", "custom_site"] as const) {
    test(`an article publishes through ${cms}, and keeps the CMS's id and URL`, async () => {
      const site = await addWebsite(t.ctx, who(), `${cms.replace("_", "-")}.maple.test`);
      await connectCms(site, cms);
      const id = await draftArticle(t.ctx, owner.orgId, site, "dental implants austin", owner.userId);
      await publishArticle(t.ctx, owner.orgId, id);
      const a = (await listArticles(t.ctx, owner.orgId, site)).find((x) => x.id === id)!;
      expect(a.status).toBe("published");
      expect(a.externalId).toBeTruthy();
      expect(a.publishedUrl).toContain("https://");
    });
  }

  test("a website's CMS is used only for that website", async () => {
    const withCms = await addWebsite(t.ctx, who(), "one.maple.test");
    const without = await addWebsite(t.ctx, who(), "two.maple.test");
    await connectCms(withCms, "webflow");
    const id = await draftArticle(t.ctx, owner.orgId, without, "teeth whitening", owner.userId);
    await expect(publishArticle(t.ctx, owner.orgId, id)).rejects.toMatchObject({ status: 409, details: { needs: "site.write" } });
  });

  test("a fix the CMS can't make is refused when proposed, naming why", async () => {
    const site = await addWebsite(t.ctx, who(), "wp-noplugin.maple.test");
    await connectCms(site, "wordpress", { siteUrl: "https://wp-noplugin.maple.test", username: "u", seoPlugin: "none" });
    await runAudit(t.ctx, owner.orgId, site);
    const [audit] = await listAudits(t.ctx, owner.orgId, site);
    const metaIssue = audit!.issues.find((i) => i.rule === "meta.description.long")!;
    await expect(proposeSiteFix(t.ctx, owner.orgId, metaIssue.id, owner.userId)).rejects.toMatchObject({
      status: 409,
      code: "unsupported_by_cms",
    });
    // A title fix is something WordPress can always do.
    const titleIssue = audit!.issues.find((i) => i.rule === "title.missing")!;
    await expect(proposeSiteFix(t.ctx, owner.orgId, titleIssue.id, owner.userId)).resolves.toMatchObject({ applied: false });
  });

  test("with an SEO plugin named, WordPress meta fixes are proposed", async () => {
    const site = await addWebsite(t.ctx, who(), "wp-yoast.maple.test");
    await connectCms(site, "wordpress", { siteUrl: "https://wp-yoast.maple.test", username: "u", seoPlugin: "yoast" });
    await runAudit(t.ctx, owner.orgId, site);
    const [audit] = await listAudits(t.ctx, owner.orgId, site);
    const metaIssue = audit!.issues.find((i) => i.rule === "meta.description.long")!;
    await expect(proposeSiteFix(t.ctx, owner.orgId, metaIssue.id, owner.userId)).resolves.toMatchObject({ applied: false });
  });
});

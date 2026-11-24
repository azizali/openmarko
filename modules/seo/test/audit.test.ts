// The site audit's rules, without a database: what counts as an issue, how robots.txt is read, health, and fixes.
import { describe, expect, test } from "bun:test";
import type { AuditPage, AuditResult } from "@app/integrations";
import { blockedAiBots, findIssues, healthOf } from "../src/audit/issues";
import { fixFor, llmsTxt, localBusinessMarkup, schemaTypeFor, type FixFacts } from "../src/audit/fixes";

const page = (path: string, over: Partial<AuditPage> = {}): AuditPage => ({
  url: `https://maple.example/${path}`,
  statusCode: 200,
  depth: path ? 1 : 0,
  title: `${path || "Home"} | Maple`,
  description: "A page.",
  h1: path || "Home",
  wordCount: 600,
  imagesMissingAlt: false,
  loadMs: 900,
  linksIn: path ? 3 : null,
  ...over,
});

const site = (over: Partial<AuditResult["site"]> = {}): AuditResult["site"] => ({
  homeUrl: "https://maple.example/",
  schemaTypes: ["Dentist"],
  phones: ["(512) 555-0142"],
  robotsTxt: "User-agent: *\nAllow: /\n",
  llmsTxt: true,
  ...over,
});

const facts: FixFacts = {
  name: "Maple & Main Dental",
  url: "https://maple.example/",
  address: "1204 S Congress Ave, Austin, TX 78704",
  phone: "(512) 555-0142",
  lat: 30.2509,
  lng: -97.7497,
  category: "Dentist",
  services: ["Teeth whitening"],
};

describe("robots.txt", () => {
  test("a group naming a bot decides for it; otherwise the * group does", () => {
    expect(blockedAiBots("User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /")).toEqual(["GPTBot"]);
    expect(blockedAiBots("User-agent: *\nDisallow: /")).toHaveLength(6);
    // A bot with its own group that allows it isn't shut out by *.
    expect(blockedAiBots("User-agent: *\nDisallow: /\n\nUser-agent: GPTBot\nAllow: /")).not.toContain("GPTBot");
    // Several agents in one group, comments, any case.
    expect(blockedAiBots("# AI\nuser-agent: perplexitybot\nUser-Agent: ClaudeBot\ndisallow: / # all")).toEqual([
      "PerplexityBot",
      "ClaudeBot",
    ]);
  });

  test("only shutting out the whole site counts", () => {
    expect(blockedAiBots("User-agent: GPTBot\nDisallow: /private/")).toEqual([]);
    expect(blockedAiBots(null)).toEqual([]);
  });
});

describe("finding issues", () => {
  test("a clean site has none and full health", () => {
    const found = findIssues(
      { pagesCrawled: 2, site: site(), pages: [page(""), page("services/teeth-whitening")] },
      {
        phone: "+1 512-555-0142",
        services: ["Teeth whitening"],
      },
    );
    expect(found.findings).toEqual([]);
    expect(found.health).toBe(100);
  });

  test("page issues are counted per page, site-wide ones sit on the home page, worst first", () => {
    const pages = [
      page(""),
      page("about", { title: "Maple" }),
      page("blog", { title: "Maple", description: null, loadMs: 4200 }),
      page("old", { statusCode: 404 }),
      page("lost", { linksIn: 0, depth: 5 }),
    ];
    const found = findIssues(
      {
        pagesCrawled: 5,
        site: site({ schemaTypes: ["WebSite"], phones: ["512 555 0199"], robotsTxt: "User-agent: GPTBot\nDisallow: /", llmsTxt: false }),
        pages,
      },
      { phone: "(512) 555-0142", services: ["Teeth whitening", "Emergency visits"] },
    );
    const by = Object.fromEntries(found.findings.map((f) => [f.code, f]));
    expect(by.duplicate_title?.count).toBe(2);
    expect(by.broken_page?.count).toBe(1);
    expect(by.slow_page?.count).toBe(1);
    expect(by.orphan_page?.count).toBe(1);
    expect(by.deep_page?.count).toBe(1);
    expect(by.phone_mismatch?.items).toEqual(["512 555 0199"]);
    expect(by.service_without_page?.items).toEqual(["Teeth whitening", "Emergency visits"]);
    expect(by.ai_bots_blocked?.items).toEqual(["GPTBot"]);
    // A broken page is only broken: its missing title isn't another issue.
    expect(found.pageIssues.get("https://maple.example/old")).toEqual(["broken_page"]);
    expect(found.pageIssues.get("https://maple.example/")).toEqual(
      expect.arrayContaining(["no_local_schema", "phone_mismatch", "ai_bots_blocked", "no_llms_txt"]),
    );
    // Errors first.
    expect(found.findings.slice(0, 4).map((f) => f.code)).toEqual(["no_local_schema", "phone_mismatch", "ai_bots_blocked", "broken_page"]);
    expect(found.health).toBe(healthOf(found.findings.map((f) => f.code)));
  });

  test("a service is covered by a page with its main word", () => {
    const found = findIssues(
      { pagesCrawled: 2, site: site(), pages: [page(""), page("services/whitening", { title: "Whitening in Austin", h1: "Whitening" })] },
      { phone: null, services: ["Teeth whitening", "Emergency visits"] },
    );
    expect(found.findings.find((f) => f.code === "service_without_page")?.items).toEqual(["Emergency visits"]);
  });

  test("with no phone on the profile, the site's phone isn't judged", () => {
    const found = findIssues({ pagesCrawled: 1, site: site({ phones: [] }), pages: [page("")] }, { phone: null, services: [] });
    expect(found.findings).toEqual([]);
  });

  test("health loses a fixed amount per kind of issue, however many pages", () => {
    expect(healthOf([])).toBe(100);
    expect(healthOf(["broken_page"])).toBe(90);
    expect(healthOf(["broken_page", "broken_page", "slow_page", "no_llms_txt"])).toBe(85);
  });
});

describe("fixes", () => {
  test("local business markup is built from the business's own facts", () => {
    const markup = localBusinessMarkup(facts);
    const json = JSON.parse(markup.replace(/^<script[^>]*>|<\/script>$/g, ""));
    expect(json).toMatchObject({ "@type": "Dentist", name: "Maple & Main Dental", telephone: "(512) 555-0142" });
    expect(schemaTypeFor("Pest control service")).toBe("PestControl");
    expect(schemaTypeFor("Something new")).toBe("LocalBusiness");
  });

  test("each fix has steps, and a snippet where one can be made", () => {
    const bots = fixFor("ai_bots_blocked", ["GPTBot", "PerplexityBot"], facts);
    expect(bots.snippet?.text).toBe("User-agent: GPTBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /");
    expect(fixFor("phone_mismatch", ["512 555 0199"], facts).steps[0]).toContain("512 555 0199");
    expect(llmsTxt(facts)).toContain("- Teeth whitening");
    expect(fixFor("broken_page", [], facts).snippet).toBeNull();
  });
});

// What a site audit counts as a problem. The provider reports facts about each page (integrations' AuditPage); this
// file decides which facts are issues, how bad each is, which check it holds back, and the site's health. Pure:
// no database, so it's tested on its own (test/audit.test.ts).
//
// Health starts at 100 and loses a fixed amount per kind of issue found, by severity, however many pages have it: a
// missing title on 40 pages is one fix (a template), not 40. Errors cost 10, warnings 4, notices 1.

import type { AuditPage, AuditResult } from "@app/integrations";
import type { Helps } from "../suggestions/kinds";

export type Severity = "error" | "warning" | "notice";
export type IssueGroup = "local" | "ai" | "crawl" | "onpage" | "speed";

export const groupNames: Record<IssueGroup, string> = {
  local: "Local signals",
  ai: "AI readiness",
  crawl: "Crawl and index",
  onpage: "On-page",
  speed: "Speed",
};
export const groupOrder: IssueGroup[] = ["local", "ai", "crawl", "onpage", "speed"];

export type IssueInfo = {
  group: IssueGroup;
  severity: Severity;
  /** The checks it holds back, the one it hurts most first. */
  helps: Helps[];
  /** The issue, as the audit lists it. */
  title: string;
  /** What fixing it is, as a to-do: "Fix 4 broken pages". */
  todo: (count: number) => string;
  /** Why it matters, in a sentence or two. */
  why: string;
  /** Whether it's about pages (listed by URL) or about the site as a whole (listed as items). */
  per: "page" | "site";
  /** For a site-wide issue with items: what one is called ("service"), so "2 services" can be said. */
  unit?: [one: string, many: string];
  /** For a site-wide issue with items: what the list of them is ("Shut out"). */
  itemsLabel?: string;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const issues = {
  no_local_schema: {
    group: "local",
    severity: "error",
    helps: ["maps", "ai"],
    title: "No local business markup on the home page",
    todo: () => "Add local business markup to your home page",
    itemsLabel: "Markup found",
    why: "Google and AI assistants read this markup (schema.org) to confirm your name, address, phone and hours. Without it they rely on guesses from other sites.",
    per: "site",
  },
  phone_mismatch: {
    group: "local",
    severity: "error",
    helps: ["maps"],
    title: "Phone number differs from the Google profile",
    todo: () => "Use your Google profile's phone number on your site",
    itemsLabel: "On your home page",
    why: "Google trusts a business more when its name, address and phone match everywhere. A different number on your own site works against you on the map.",
    per: "site",
  },
  phone_missing: {
    group: "local",
    severity: "warning",
    helps: ["maps"],
    title: "No phone number on the home page",
    todo: () => "Put your phone number on your home page",
    why: "Your phone number on the home page, matching your Google profile, is one of the signals Google uses to tie your site to your business.",
    per: "site",
  },
  service_without_page: {
    group: "local",
    severity: "warning",
    helps: ["keywords", "maps"],
    title: "Services with no page of their own",
    todo: (n) => `Write a page for ${plural(n, "service")} you offer`,
    unit: ["service", "services"],
    itemsLabel: "Services without a page",
    why: "A page about one service is what Google ranks for a search about that service. Services mentioned only in passing rarely rank.",
    per: "site",
  },
  ai_bots_blocked: {
    group: "ai",
    severity: "error",
    helps: ["ai"],
    title: "robots.txt shuts out AI assistants",
    todo: () => "Let AI assistants read your site",
    unit: ["AI crawler", "AI crawlers"],
    itemsLabel: "Shut out",
    why: "ChatGPT, Perplexity and others skip sites their crawlers are told to stay out of, so they can't quote or recommend you from your own pages.",
    per: "site",
  },
  no_llms_txt: {
    group: "ai",
    severity: "notice",
    helps: ["ai"],
    title: "No llms.txt",
    todo: () => "Add an llms.txt file",
    why: "A short plain-text summary at /llms.txt tells AI assistants what you do and which pages matter. Few sites have one yet; it's cheap to add.",
    per: "site",
  },
  broken_page: {
    group: "crawl",
    severity: "error",
    helps: ["keywords"],
    title: "Pages that don't load",
    todo: (n) => `Fix ${plural(n, "broken page")}`,
    why: "Links to pages that answer with an error waste Google's visits and lose visitors. Fix the page, or point the links somewhere that works.",
    per: "page",
  },
  orphan_page: {
    group: "crawl",
    severity: "notice",
    helps: ["keywords"],
    title: "Pages no other page links to",
    todo: (n) => `Link to ${plural(n, "page")} nothing links to`,
    why: "Google finds and weighs pages by the links pointing at them. A page nothing links to is hard to find and seldom ranks.",
    per: "page",
  },
  deep_page: {
    group: "crawl",
    severity: "notice",
    helps: ["keywords"],
    title: "Pages 4 or more clicks from the home page",
    todo: (n) => `Bring ${plural(n, "page")} closer to the home page`,
    why: "The further a page sits from the home page, the less often Google reads it and the less it's worth.",
    per: "page",
  },
  missing_title: {
    group: "onpage",
    severity: "warning",
    helps: ["keywords"],
    title: "Pages without a title",
    todo: (n) => `Give ${plural(n, "page")} a title`,
    why: "The title is what Google shows as the blue link, and its strongest hint about what a page is for.",
    per: "page",
  },
  duplicate_title: {
    group: "onpage",
    severity: "warning",
    helps: ["keywords"],
    title: "Pages sharing a title with another page",
    todo: (n) => `Give ${plural(n, "page")} a title of ${n === 1 ? "its" : "their"} own`,
    why: "When pages share a title Google can't tell which to show, and often shows neither.",
    per: "page",
  },
  missing_description: {
    group: "onpage",
    severity: "notice",
    helps: ["keywords"],
    title: "Pages without a meta description",
    todo: (n) => `Write a description for ${plural(n, "page")}`,
    why: "The description is the text under the link in Google. Without one Google picks a sentence, often not the one you'd choose.",
    per: "page",
  },
  missing_h1: {
    group: "onpage",
    severity: "notice",
    helps: ["keywords"],
    title: "Pages without a main heading",
    todo: (n) => `Add a main heading to ${plural(n, "page")}`,
    why: "The main heading (H1) tells readers and Google what the page is about at a glance.",
    per: "page",
  },
  thin_content: {
    group: "onpage",
    severity: "notice",
    helps: ["keywords", "ai"],
    title: "Pages with under 200 words",
    todo: (n) => `Say more on ${plural(n, "page")}`,
    why: "Pages with very little text rarely rank, and give AI assistants nothing to quote.",
    per: "page",
  },
  images_missing_alt: {
    group: "onpage",
    severity: "notice",
    helps: ["keywords"],
    title: "Pages with images missing alt text",
    todo: (n) => `Describe the images on ${plural(n, "page")}`,
    why: "Alt text is how search engines and screen readers know what an image shows.",
    per: "page",
  },
  slow_page: {
    group: "speed",
    severity: "warning",
    helps: ["keywords", "maps"],
    title: "Pages taking over 3 seconds to load",
    todo: (n) => `Speed up ${plural(n, "page")}`,
    why: "Slow pages lose visitors before they see anything, and Google ranks fast pages above slow ones when all else is equal.",
    per: "page",
  },
} satisfies Record<string, IssueInfo>;

export type IssueCode = keyof typeof issues;
export const issueCodes = Object.keys(issues) as IssueCode[];
export const issueOf = (code: string): IssueInfo | null => (code in issues ? issues[code as IssueCode] : null);

export const severityWeight: Record<Severity, number> = { error: 10, warning: 4, notice: 1 };
export const severityOrder: Severity[] = ["error", "warning", "notice"];

/** What the audit knows of the business, to compare the site with. */
export type BusinessFacts = {
  /** The phone on its Google profile, as written there. */
  phone: string | null;
  /** What it offers, as tracked: each should have a page. */
  services: string[];
};

/** One kind of issue found in a crawl: on how many pages (or items), and the site-wide items it's about. */
export type Finding = { code: IssueCode; count: number; items: string[] };

/** What a crawl found: issues per page, the site-wide findings, and its health. */
export type AuditFindings = {
  pageIssues: Map<string, IssueCode[]>;
  findings: Finding[];
  blockedBots: string[];
  health: number;
};

/** The AI crawlers robots.txt can shut out, by their user-agent names. */
export const aiBots = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot", "Google-Extended"];

/**
 * The AI crawlers a robots.txt shuts out of the whole site (`Disallow: /`). A group naming a bot decides for it;
 * otherwise the `*` group does. An `Allow: /` in the same group opens it again.
 */
export function blockedAiBots(robotsTxt: string | null): string[] {
  if (!robotsTxt) return [];
  type Group = { agents: string[]; blocksAll: boolean; allowsAll: boolean };
  const groups: Group[] = [];
  let current: Group | null = null;
  let inAgents = false;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const [, key, value] = m as unknown as [string, string, string];
    const k = key.toLowerCase();
    if (k === "user-agent") {
      if (!inAgents || !current) {
        current = { agents: [], blocksAll: false, allowsAll: false };
        groups.push(current);
      }
      current.agents.push(value.trim().toLowerCase());
      inAgents = true;
      continue;
    }
    inAgents = false;
    if (!current) continue;
    if (k === "disallow" && value.trim() === "/") current.blocksAll = true;
    if (k === "allow" && value.trim() === "/") current.allowsAll = true;
  }
  const decides = (agent: string) => groups.filter((g) => g.agents.includes(agent));
  const blocked = (g: Group[]) => g.some((x) => x.blocksAll) && !g.some((x) => x.allowsAll);
  return aiBots.filter((bot) => {
    const own = decides(bot.toLowerCase());
    return own.length ? blocked(own) : blocked(decides("*"));
  });
}

const digits = (s: string) => s.replace(/\D/g, "").slice(-10);

/** Generic schema.org types: a site with only these says nothing about being a local business. */
const genericTypes = new Set(
  [
    "WebSite",
    "WebPage",
    "Organization",
    "BreadcrumbList",
    "ListItem",
    "ItemList",
    "ImageObject",
    "VideoObject",
    "Person",
    "SiteNavigationElement",
    "SearchAction",
    "FAQPage",
    "Question",
    "Answer",
    "Article",
    "BlogPosting",
    "CreativeWork",
    "Thing",
    "Product",
    "Offer",
    "Service",
    "Review",
    "AggregateRating",
    "Rating",
    "PostalAddress",
    "GeoCoordinates",
    "ContactPoint",
    "OpeningHoursSpecification",
  ].map((t) => t.toLowerCase()),
);
const hasLocalType = (types: string[]) => types.some((t) => !genericTypes.has(t.toLowerCase()));

/**
 * Whether a page is about a service: its address, title or heading has the service's longest word and at least half
 * its words ("Teeth whitening" is covered by "Whitening in Austin"; "Emergency visits" isn't by "Visit us").
 */
function coversService(page: AuditPage, service: string): boolean {
  const words = service
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2)
    .map((w) => w.replace(/s$/, ""));
  if (!words.length) return true;
  const text = `${page.url} ${page.title ?? ""} ${page.h1 ?? ""}`.toLowerCase();
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a));
  return text.includes(longest) && words.filter((w) => text.includes(w)).length >= Math.ceil(words.length / 2);
}

/** Turns a crawl into issues and a health score. */
export function findIssues(result: AuditResult, business: BusinessFacts): AuditFindings {
  const pageIssues = new Map<string, IssueCode[]>();
  const add = (url: string, code: IssueCode) => pageIssues.set(url, [...(pageIssues.get(url) ?? []), code]);
  const ok = result.pages.filter((p) => p.statusCode < 400);

  // Titles shared by more than one page that loads.
  const titled = new Map<string, number>();
  for (const p of ok) if (p.title) titled.set(p.title.trim().toLowerCase(), (titled.get(p.title.trim().toLowerCase()) ?? 0) + 1);

  for (const p of result.pages) {
    if (p.statusCode >= 400) {
      add(p.url, "broken_page");
      continue;
    }
    if (p.statusCode >= 300) continue;
    if (!p.title) add(p.url, "missing_title");
    else if ((titled.get(p.title.trim().toLowerCase()) ?? 0) > 1) add(p.url, "duplicate_title");
    if (!p.description) add(p.url, "missing_description");
    if (!p.h1) add(p.url, "missing_h1");
    if (p.wordCount !== null && p.wordCount < 200) add(p.url, "thin_content");
    if (p.imagesMissingAlt) add(p.url, "images_missing_alt");
    if (p.loadMs !== null && p.loadMs > 3000) add(p.url, "slow_page");
    if (p.depth !== 0 && p.linksIn === 0) add(p.url, "orphan_page");
    if (p.depth !== null && p.depth >= 4) add(p.url, "deep_page");
  }

  const findings: Finding[] = [];
  const counts = new Map<IssueCode, number>();
  for (const codes of pageIssues.values()) for (const c of codes) counts.set(c, (counts.get(c) ?? 0) + 1);
  for (const [code, count] of counts) findings.push({ code, count, items: [] });

  const site = result.site;
  if (!hasLocalType(site.schemaTypes)) findings.push({ code: "no_local_schema", count: 1, items: site.schemaTypes });
  if (business.phone) {
    if (!site.phones.length) findings.push({ code: "phone_missing", count: 1, items: [] });
    else if (!site.phones.some((p) => digits(p) === digits(business.phone!)))
      findings.push({ code: "phone_mismatch", count: 1, items: site.phones });
  }
  const missing = business.services.filter((s) => !ok.some((p) => coversService(p, s)));
  if (missing.length) findings.push({ code: "service_without_page", count: missing.length, items: missing });
  const blockedBots = blockedAiBots(site.robotsTxt);
  if (blockedBots.length) findings.push({ code: "ai_bots_blocked", count: blockedBots.length, items: blockedBots });
  if (!site.llmsTxt) findings.push({ code: "no_llms_txt", count: 1, items: [] });

  // Site-wide findings are listed on the home page, so every finding has a page to show.
  for (const f of findings) if (issues[f.code].per === "site") add(site.homeUrl, f.code);

  return { pageIssues, findings: sortFindings(findings), blockedBots, health: healthOf(findings.map((f) => f.code)) };
}

/** 100, less each kind of issue found by its severity. */
export function healthOf(codes: IssueCode[]): number {
  const lost = [...new Set(codes)].reduce((n, c) => n + severityWeight[issues[c].severity], 0);
  return Math.max(0, Math.round(100 - lost));
}

/** Worst first, then by group, then most pages first. */
export function sortFindings<T extends { code: IssueCode; count: number }>(list: T[]): T[] {
  return list.toSorted(
    (a, b) =>
      severityOrder.indexOf(issues[a.code].severity) - severityOrder.indexOf(issues[b.code].severity) ||
      groupOrder.indexOf(issues[a.code].group) - groupOrder.indexOf(issues[b.code].group) ||
      b.count - a.count,
  );
}

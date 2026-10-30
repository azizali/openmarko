// Mock data split by Location and by Website, so switching the Scope shows
// different numbers. South Congress (loc_1) and its Website (web_1) use the
// original mock data; Mueller (loc_2, web_2) is newer, smaller and has its own
// gaps. Real build: every one of these is stored per Location or per Website.

import { auditIssues, auditSummary, business, competitors, gbpInsights, keywords, reviews, type AuditIssue, type Competitor, type Keyword } from "./mock";
import { aiPrompts, type AiPrompt } from "./ai";
import { citations, linkHistory, linkSummary, type Citation, type CitationStatus } from "./authority";

export type Review = (typeof reviews)[number];

export const locationData: Record<string, { rating: number; reviewCount: number; insights: typeof gbpInsights; reviews: Review[]; completeness: number }> = {
  loc_1: { rating: 4.7, reviewCount: 212, insights: gbpInsights, reviews, completeness: 50 },
  loc_2: {
    rating: 4.8, reviewCount: 64, completeness: 38,
    insights: { calls: 71, callsPrev: 52, directions: 140, directionsPrev: 118, websiteClicks: 166, websiteClicksPrev: 149, views: 3920, viewsPrev: 3310 },
    reviews: [
      { id: "m1", author: "Chris W.", rating: 5, date: "1 day ago", text: "New to Mueller and so glad we found this office. Easy parking and very gentle with my son.", replied: false },
      { id: "m2", author: "Tasha B.", rating: 3, date: "6 days ago", text: "Nice staff but my appointment started 25 minutes late.", replied: false },
      { id: "m3", author: "Omar H.", rating: 5, date: "2 weeks ago", text: "Got my crown done in one visit. Clear on the price upfront.", replied: true },
    ],
  },
};

/** The keywords tracked for a Location, with that Location's ranks. */
export function keywordsFor(locationId: string): Keyword[] {
  if (locationId !== "loc_2") return keywords;
  // Mueller tracks its first 9 keywords, and is newer: map ranks are a few spots lower.
  return keywords.slice(0, 9).map((k, i) => ({
    ...k,
    id: `${k.id}_m`,
    term: k.term.replace("south austin", "mueller").replace("dentist austin", i % 3 === 0 ? "dentist mueller" : "dentist austin"),
    local: k.local === null ? null : Math.min(20, k.local + 2 + (i % 3)),
    localPrev: k.localPrev === null ? null : Math.min(20, k.localPrev + 3 + (i % 2)),
    organic: k.organic === null ? null : Math.min(60, k.organic + 6 + i),
    organicPrev: k.organicPrev === null ? null : Math.min(60, k.organicPrev + 5 + i),
  }));
}

/** Where a Location is listed, and whether the details match. */
export function citationsFor(locationId: string): Citation[] {
  if (locationId !== "loc_2") return citations;
  // Mueller opened this year: most directories don't have it yet.
  const missing = new Set(["bbb", "healthgrades", "webmd", "dataaxle", "foursquare", "yp", "mapquest", "ada", "manta"]);
  return citations.map((c) => (missing.has(c.id) ? { ...c, status: "missing" as CitationStatus, issue: undefined } : c.status === "missing" ? { ...c, status: "correct" as CitationStatus } : { ...c, status: c.status === "duplicate" ? "correct" : c.status, issue: c.status === "duplicate" ? undefined : c.issue }));
}

export const websiteData: Record<string, { summary: typeof auditSummary; issues: AuditIssue[] }> = {
  web_1: { summary: auditSummary, issues: auditIssues },
  web_2: {
    summary: { ...auditSummary, score: 81, prevScore: 79, pages: 14, crawled: "2026-10-29 05:40", duration: "48s", lcp: 2.1, cls: 0.02, inp: 140 },
    issues: auditIssues.filter((i) => ["i1", "i5", "i6"].includes(i.id)).map((i) => ({ ...i, pages: i.pages.slice(0, 2) })),
  },
};

/** Each Website's links. Mueller's site is new, so it has few. */
export const linkData: Record<string, { you: typeof linkSummary.you; history: number[] }> = {
  web_1: { you: linkSummary.you, history: linkHistory.you },
  web_2: { you: { refDomains: 9, backlinks: 31, localDomains: 1, new30: 3, lost30: 0, rank: 74 }, history: [2, 3, 4, 6, 7, 9] },
};

/** The map-pack rivals around a Location, with this Location's own numbers as "you". */
export function competitorsFor(locationId: string): Competitor[] {
  if (locationId !== "loc_2") return competitors;
  // Around Mueller the same chains show up, but further away and the field is thinner.
  return competitors.map((c) => (c.isYou ? { ...c, name: `${c.name} (Mueller)`, rating: 4.8, reviews: 64, reviewVelocity: 5, photos: 22, solv: 18, avgGridRank: 8.1, posts30d: 0 } : { ...c, solv: Math.max(6, c.solv - 14), distanceMi: +(c.distanceMi + 3.4).toFixed(1) }));
}

/** The questions asked of AI assistants about a Location. Mueller is named in far fewer answers. */
export function aiPromptsFor(locationId: string): AiPrompt[] {
  if (locationId !== "loc_2") return aiPrompts;
  return aiPrompts.map((p, i) => ({
    ...p,
    text: p.text.replace(/south congress|south austin|78704/gi, "Mueller"),
    answers: p.answers.map((a, j) => ((i + j) % 3 === 0 ? a : { ...a, listed: a.listed.filter((n) => n !== business.name), position: null, excerpt: a.excerpt.replace(/on South Congress/g, "in Mueller") })),
    history: p.history.map((h) => Math.max(0, h - 2)),
  }));
}

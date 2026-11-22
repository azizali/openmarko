// Data for the SEO section (#/seo): four things we check, and the suggestions that come out of them.
// Competitors are not one list: who is ahead depends on the keyword and on where the person searched (the map,
// Google's normal results, or an AI assistant), so everything here is worked out per keyword and per channel.
// Each check and each kind of suggestion names where its data would come from, so the page doubles as a build list.

import { business, competitors, gridStats, makeGrid, makeRivalGrid, type Competitor, type GridScan } from "./mock";

export const you: Competitor = competitors.find((c) => c.isYou)!;
/** Every local business seen in the top 3 somewhere on the map grid. Found, not typed in. */
export const businesses: Competitor[] = competitors.filter((c) => !c.isYou);
const [r1, r2, r3, r4, r5] = businesses as [Competitor, Competitor, Competitor, Competitor, Competitor];

// ---------- Checks ----------

export type CheckId = "maps" | "keywords" | "ai" | "competitors";

export const sources: Record<CheckId, string> = {
  maps: "DataForSEO SERP API, Google Maps: one request per spot on the grid, per keyword. Each result lists every business at that spot, so competitors come free.",
  keywords:
    "DataForSEO SERP API, Google Organic, searched from the business's own coordinates: the top 10 results per keyword. Searches per month from the Keywords Data API.",
  ai: "DataForSEO AI Optimization API: the ChatGPT and Perplexity answers with the sites they cite, and the AI Overview that comes back with a Google search.",
  competitors:
    "No requests of its own. It counts who appears in the map, Google and AI results already collected, plus DataForSEO Business Data for each profile's rating and reviews.",
};

export type TrackedKeyword = {
  id: string;
  term: string;
  volume: number;
  /** Position in Google's normal results; null is not in the top 100. */
  google: number | null;
  googlePrev: number | null;
  /** Added from a suggestion a moment ago: no result yet. */
  pending?: boolean;
};

export const baseKeywords: TrackedKeyword[] = [
  {
    id: "kw_1",
    term: "dentist austin",
    volume: 6600,
    google: 14,
    googlePrev: 17,
  },
  {
    id: "kw_2",
    term: "dentist near me",
    volume: 49500,
    google: 9,
    googlePrev: 9,
  },
  {
    id: "kw_4",
    term: "teeth whitening austin",
    volume: 1300,
    google: 6,
    googlePrev: 11,
  },
  {
    id: "kw_6",
    term: "family dentist south austin",
    volume: 480,
    google: 3,
    googlePrev: 4,
  },
  {
    id: "kw_7",
    term: "dental implants austin",
    volume: 1600,
    google: 23,
    googlePrev: 28,
  },
  {
    id: "kw_8",
    term: "kids dentist austin",
    volume: 880,
    google: 12,
    googlePrev: 10,
  },
];

/** How many keywords the plan tracks. Each one costs a weekly Google search and a map grid, so it is capped. */
export const KEYWORD_LIMIT = 20;

/** Offered when adding keywords by hand: from the business's services and what competitors' sites rank for. */
export const keywordIdeas: { term: string; volume: number }[] = [
  { term: "emergency dentist austin", volume: 1900 },
  { term: "invisalign austin", volume: 2400 },
  { term: "root canal austin", volume: 720 },
  { term: "dentist open saturday austin", volume: 390 },
  { term: "veneers austin", volume: 1000 },
  { term: "dentist south congress", volume: 210 },
];
/** Searches a month for a typed keyword. Real build: one Keywords Data request for the whole list. */
export function volumeOf(term: string) {
  const known = keywordIdeas.find((i) => i.term === term);
  if (known) return known.volume;
  let h = 0;
  for (const ch of term) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return 50 + (h % 140) * 10;
}

/** The map grid for a keyword, for you or another business. `ago` is the scan from 30 days back. */
export function gridFor(keywordId: string, who: Competitor = you, ago = false): GridScan {
  if (!who.isYou) return makeRivalGrid(keywordId, who, 7, ago ? 2 : 1);
  const n = Number(keywordId.split("_")[1]);
  return makeGrid(keywordId, 7, ago ? 2 : 1, 2.5 + (n % 3) - (ago ? 1 : 0));
}
export const top3Spots = (keywordId: string, who: Competitor = you, ago = false) => gridStats(gridFor(keywordId, who, ago)).top3;
export const GRID_SPOTS = 49;

// ---------- Reading a map grid ----------

/** Average position over every spot (21 where not found), and the position when searching from your own door. */
export const avgPosition = (keywordId: string, who: Competitor = you, ago = false) => gridStats(gridFor(keywordId, who, ago)).arp;
export function doorPosition(keywordId: string, who: Competitor = you) {
  const scan = gridFor(keywordId, who);
  const c = (scan.size - 1) / 2;
  return scan.points.find((p) => p.row === c && p.col === c)!.rank;
}

const sides: [string, (row: number, col: number, c: number) => boolean][] = [
  ["north", (row, _col, c) => row < c],
  ["south", (row, _col, c) => row > c],
  ["east", (_row, col, c) => col > c],
  ["west", (_row, col, c) => col < c],
];
/** The side of the area where a business does best and worst, by average position. Null when it's in the top 3 nowhere. */
export function reach(keywordId: string, who: Competitor = you): { best: string; worst: string } | null {
  const scan = gridFor(keywordId, who);
  if (!scan.points.some((p) => (p.rank ?? 99) <= 3)) return null;
  const c = (scan.size - 1) / 2;
  const avg = sides
    .map(([name, on]) => {
      const pts = scan.points.filter((p) => on(p.row, p.col, c));
      return {
        name,
        avg: pts.reduce((n, p) => n + (p.rank ?? 21), 0) / pts.length,
      };
    })
    .sort((a, b) => a.avg - b.avg);
  return { best: avg[0]!.name, worst: avg[avg.length - 1]!.name };
}

/** Thirteen weekly counts of top-3 spots, ending today; the scan from 30 days back sits four weeks from the end. */
export function spotsHistory(keywordId: string, who: Competitor = you): number[] {
  const now = top3Spots(keywordId, who);
  const ago = top3Spots(keywordId, who, true);
  const n = Number(keywordId.split("_")[1]) + who.id.charCodeAt(who.id.length - 1);
  const start = Math.max(0, ago - 2 - (n % 3));
  return Array.from({ length: 13 }, (_, i) => {
    if (i === 12) return now;
    if (i === 8) return ago;
    const base = i < 8 ? start + ((ago - start) * i) / 8 : ago + ((now - ago) * (i - 8)) / 4;
    return Math.max(0, Math.round(base + (((i * 7 + n) % 3) - 1)));
  });
}
/** Thirteen weekly values passing two real readings: `ago` (30 days back, four weeks from the end) and `now`. Mock history for a chart. */
export function weekly(ago: number, now: number, wobble = 0): number[] {
  const start = Math.max(0, ago - Math.max(1, Math.abs(now - ago)));
  return Array.from({ length: 13 }, (_, i) => {
    if (i === 12) return now;
    if (i === 8) return ago;
    const base = i < 8 ? start + ((ago - start) * i) / 8 : ago + ((now - ago) * (i - 8)) / 4;
    return Math.max(0, Math.round(base + (((i * 7) % 3) - 1) * wobble));
  });
}
export const weekLabels = Array.from({ length: 13 }, (_, i) => {
  const d = new Date(2026, 10, 16 - (12 - i) * 7);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
});

/** What a Google profile is compared on. Higher is better for all of them. */
export const profileFacts: {
  label: string;
  of: (c: Competitor) => number;
  show?: (c: Competitor) => string;
}[] = [
  { label: "Rating", of: (c) => c.rating, show: (c) => c.rating.toFixed(1) },
  { label: "Reviews", of: (c) => c.reviews },
  { label: "New / mo", of: (c) => c.reviewVelocity },
  { label: "Photos", of: (c) => c.photos },
  { label: "Posts / mo", of: (c) => c.posts30d },
  { label: "Categories", of: (c) => c.categories.length },
];

// ---------- Google's normal results ----------

/** Anything that can sit above you on Google: another local business, or a directory or publisher. */
export type Site = {
  id: string;
  name: string;
  domain: string;
  kind: "business" | "directory";
  biz?: Competitor;
};

export const directories: Site[] = [
  { id: "d_yelp", name: "Yelp", domain: "yelp.com", kind: "directory" },
  {
    id: "d_healthgrades",
    name: "Healthgrades",
    domain: "healthgrades.com",
    kind: "directory",
  },
  { id: "d_zocdoc", name: "Zocdoc", domain: "zocdoc.com", kind: "directory" },
  { id: "d_reddit", name: "Reddit", domain: "reddit.com", kind: "directory" },
  {
    id: "d_chronicle",
    name: "Austin Chronicle",
    domain: "austinchronicle.com",
    kind: "directory",
  },
  {
    id: "d_opencare",
    name: "Opencare",
    domain: "opencare.com",
    kind: "directory",
  },
];
export const sites: Site[] = [
  ...businesses.map((b): Site => ({
    id: b.id,
    name: b.name,
    domain: b.website,
    kind: "business",
    biz: b,
  })),
  ...directories,
];

const top10Cache = new Map<string, (Site | "you")[]>();
/** Google's first page for a keyword, in order. "you" is in it when you rank in the top 10. */
export function googleTop10(k: TrackedKeyword): (Site | "you")[] {
  const hit = top10Cache.get(k.id);
  if (hit) return hit;
  let seed = Number(k.id.split("_")[1]) * 7919 + 13;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pool = [...sites];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const list: (Site | "you")[] = pool.slice(0, 10);
  if (k.google !== null && k.google <= 10) {
    list.splice(k.google - 1, 0, "you");
    list.length = 10;
  }
  top10Cache.set(k.id, list);
  return list;
}
/** A site's position on Google for a keyword; null is off the first page (yours is known further down). */
export function googlePos(k: TrackedKeyword, site: Site | "you"): number | null {
  if (site === "you") return k.google;
  const i = googleTop10(k).indexOf(site);
  return i < 0 ? null : i + 1;
}

// ---------- AI answers ----------

export type EngineId = "chatgpt" | "google" | "perplexity";
export const engines: { id: EngineId; name: string }[] = [
  { id: "chatgpt", name: "ChatGPT" },
  { id: "google", name: "Google AI" },
  { id: "perplexity", name: "Perplexity" },
];

export type AiAnswer = {
  you: boolean;
  /** The other businesses it recommends, in the order it gives them. */
  named: string[];
  /** Your place in that list (1 is first) when it names you. */
  at?: number;
  cites: string[];
  /** The opening of the answer, as the person reads it. */
  excerpt: string;
};
export type TrackedPrompt = {
  id: string;
  text: string;
  /** Per engine: were you named and where, who else was, which sites the answer leaned on, and what it said. */
  answers: Record<EngineId, AiAnswer>;
  pending?: boolean;
};

const answer = (youNamed: boolean, named: string[], cites: string[], excerpt: string, at?: number): AiAnswer => ({
  you: youNamed,
  named,
  cites,
  excerpt,
  at: youNamed ? (at ?? 1) : undefined,
});

/** The answer's list in order, with you in your place. */
export function ranked(a: AiAnswer): string[] {
  if (!a.you) return a.named;
  const list = [...a.named];
  list.splice((a.at ?? 1) - 1, 0, business.name);
  return list;
}

const you_ = business.name;
export const basePrompts: TrackedPrompt[] = [
  {
    id: "p_1",
    text: "Who is the best dentist in South Austin?",
    answers: {
      chatgpt: answer(
        true,
        [r1.name, r2.name],
        ["yelp.com", "reddit.com"],
        `Several South Austin practices are well reviewed. ${r1.name} is often praised for gentle care, and ${you_} is a popular choice on South Congress…`,
        2,
      ),
      google: answer(
        true,
        [r1.name, r4.name],
        ["yelp.com", r1.website],
        `Top-rated dentists in South Austin include ${you_} (4.8 stars), ${r1.name} and ${r4.name}, based on reviews and services offered…`,
        1,
      ),
      perplexity: answer(
        false,
        [r1.name, r3.name, r4.name],
        ["reddit.com", "healthgrades.com"],
        `Locals on Reddit most often recommend ${r1.name}, with ${r3.name} and ${r4.name} also mentioned for families…`,
      ),
    },
  },
  {
    id: "p_2",
    text: "Where can I get my teeth whitened in Austin?",
    answers: {
      chatgpt: answer(
        false,
        [r1.name, r5.name],
        ["yelp.com", r5.website],
        `For professional whitening, ${r1.name} and ${r5.name} both offer in-office and take-home options…`,
      ),
      google: answer(
        true,
        [r5.name],
        [business.website, "yelp.com"],
        `In-office whitening in Austin typically costs $300 to $600. ${r5.name} and ${you_} offer same-day Zoom whitening…`,
        2,
      ),
      perplexity: answer(
        false,
        [r1.name, r5.name],
        ["reddit.com", "yelp.com"],
        `${r1.name} gets the most mentions for whitening results, followed by ${r5.name}…`,
      ),
    },
  },
  {
    id: "p_3",
    text: "Which Austin dentists take new patients this week?",
    answers: {
      chatgpt: answer(
        false,
        [r2.name],
        ["zocdoc.com"],
        `${r2.name} shows open new-patient appointments this week on Zocdoc. Availability changes daily, so book online…`,
      ),
      google: answer(
        false,
        [r1.name, r2.name],
        ["zocdoc.com", "opencare.com"],
        `${r1.name} and ${r2.name} list new-patient openings this week on Zocdoc and Opencare…`,
      ),
      perplexity: answer(
        false,
        [r2.name, r1.name],
        ["zocdoc.com", "healthgrades.com"],
        `Based on Zocdoc listings, ${r2.name} has the soonest new-patient slots, with ${r1.name} close behind…`,
      ),
    },
  },
  {
    id: "p_4",
    text: "Who is a good dentist for kids in Austin?",
    answers: {
      chatgpt: answer(
        false,
        [r3.name, r2.name],
        ["austinchronicle.com", "yelp.com"],
        `${r3.name} was voted a favourite family dentist by Austin Chronicle readers. ${r2.name} also sees children…`,
      ),
      google: answer(
        false,
        [r3.name],
        [r3.website, "healthgrades.com"],
        `${r3.name} focuses on family and children's dentistry, with a play area and evening hours…`,
      ),
      perplexity: answer(
        true,
        [r3.name],
        ["reddit.com", business.website],
        `Parents recommend ${r3.name} and ${you_} for patient, kid-friendly care. ${you_} offers first visits from age one…`,
        2,
      ),
    },
  },
  {
    id: "p_5",
    text: "Who does dental implants in Austin and what do they cost?",
    answers: {
      chatgpt: answer(
        false,
        [r4.name, r1.name],
        [r4.website, "healthgrades.com"],
        `A single implant in Austin usually costs $3,000 to $5,000. ${r4.name} lists implant pricing on its site, and ${r1.name} offers free consults…`,
      ),
      google: answer(
        false,
        [r4.name, r5.name],
        [r4.website, "yelp.com"],
        `${r4.name} and ${r5.name} both place implants in-house. Expect $3,500 to $4,500 per tooth including the crown…`,
      ),
      perplexity: answer(
        false,
        [r4.name],
        ["reddit.com", r4.website],
        `${r4.name} is the name that comes up most for implants, and publishes prices from $3,200…`,
      ),
    },
  },
];

/** How many answers named a business (you, when no name is given), across the tracked questions. */
export function aiNamed(prompts: TrackedPrompt[], name?: string, engine?: EngineId) {
  const live = prompts.filter((p) => !p.pending);
  const asked = engines.filter((e) => !engine || e.id === engine);
  let hits = 0;
  for (const p of live) for (const e of asked) if (name ? p.answers[e.id].named.includes(name) : p.answers[e.id].you) hits++;
  return { hits, total: live.length * asked.length };
}

/** The sites AI answers lean on, most cited first. Being listed on these is how a business gets named. */
export function aiCites(prompts: TrackedPrompt[]) {
  const counts = new Map<string, number>();
  for (const p of prompts.filter((x) => !x.pending))
    for (const e of engines) for (const d of p.answers[e.id].cites) counts.set(d, (counts.get(d) ?? 0) + 1);
  return [...counts].map(([domain, count]) => ({ domain, count })).sort((a, b) => b.count - a.count);
}

// ---------- Competitors, per channel ----------

/** Where the person searched. Each has its own competitors. */
export type Channel = "maps" | "google" | "ai";
export const channels: { id: Channel; name: string; unit: string }[] = [
  {
    id: "maps",
    name: "Google Maps",
    unit: `Spots in the top 3, out of ${GRID_SPOTS}`,
  },
  { id: "google", name: "Google search", unit: "Position on the first page" },
  {
    id: "ai",
    name: "AI answers",
    unit: `Assistants that name them, out of ${engines.length}`,
  },
];

/** What a channel is measured over: the tracked keywords, or the tracked questions. */
export const columns = (channel: Channel): { id: string; label: string }[] =>
  channel === "ai" ? basePrompts.map((p) => ({ id: p.id, label: p.text })) : baseKeywords.map((k) => ({ id: k.id, label: k.term }));

/** One cell of the comparison: how a site (or you) does in a channel for one keyword or question. */
export function score(channel: Channel, site: Site | "you", columnId: string): number | null {
  if (channel === "ai") {
    const p = basePrompts.find((x) => x.id === columnId)!;
    return engines.filter((e) => (site === "you" ? p.answers[e.id].you : p.answers[e.id].named.includes(site.name))).length;
  }
  if (channel === "google")
    return googlePos(
      baseKeywords.find((k) => k.id === columnId)!,
      site,
    );
  if (site === "you") return top3Spots(columnId);
  return site.biz ? top3Spots(columnId, site.biz) : null;
}

/** Is their score better than yours? Lower is better on Google; higher everywhere else. */
export function ahead(channel: Channel, theirs: number | null, yours: number | null) {
  if (theirs === null) return false;
  if (channel === "google") return yours === null || theirs < yours;
  return theirs > (yours ?? 0);
}

/** On how many keywords (or questions) a site is ahead of you in a channel. */
export const aheadCount = (channel: Channel, site: Site) =>
  columns(channel).filter((c) => ahead(channel, score(channel, site, c.id), score(channel, "you", c.id))).length;

/** Who competes with you in a channel, the one ahead of you most often first. */
export function field(channel: Channel): Site[] {
  const cols = columns(channel);
  return sites
    .filter((s) => cols.some((c) => (score(channel, s, c.id) ?? 0) > 0))
    .sort((a, b) => aheadCount(channel, b) - aheadCount(channel, a));
}

// ---------- Suggestions ----------

export type SuggestionKind = "keyword" | "prompt" | "profile" | "post";

export const kinds: Record<SuggestionKind, { label: string; action: string; done: string; source: string }> = {
  keyword: {
    label: "Track a keyword",
    action: "Track it",
    done: "Tracking. First result in a few minutes.",
    source: "DataForSEO Labs: the keywords each competitor's website ranks for, minus the ones you already track.",
  },
  prompt: {
    label: "Track an AI question",
    action: "Track it",
    done: "Tracking. First answers in a few minutes.",
    source:
      "Written by the AI model from your services, your city and what competitors' reviews talk about. Checked with the DataForSEO AI Optimization API.",
  },
  profile: {
    label: "Change your Google profile",
    action: "Apply to Google",
    done: "Sent to Google. Changes can take a day to show.",
    source:
      "Compares your profile with competitors' (DataForSEO Business Data). Applied with the Google Business Profile API, once you connect Google.",
  },
  post: {
    label: "Post on your Google profile",
    action: "Publish",
    done: "Published on your Google profile.",
    source: "Draft written by the AI model. Published with the Google Business Profile API.",
  },
};

export type Suggestion = {
  id: string;
  kind: SuggestionKind;
  /** The check this should move. */
  helps: Exclude<CheckId, "competitors">;
  title: string;
  /** One sentence: why this, why now. */
  why: string;
  /** What we saw that led here. */
  evidence: string[];
  /** A keyword or question to start tracking. */
  track?: string;
  volume?: number;
  /** A profile field, as it is and as it would be. */
  change?: { field: string; before: string; after: string };
  /** Text to publish; the owner can edit it first. */
  draft?: string;
};

export const suggestions: Suggestion[] = [
  {
    id: "s_cat",
    kind: "profile",
    helps: "maps",
    title: "Add two categories to your Google profile",
    why: `All three competitors list these categories. You don't, so Google leaves you out of those searches.`,
    evidence: [
      `${r1.name}, ${r2.name} and ${r3.name} all list “Emergency dental service”.`,
      `Two of them list “Teeth whitening service”.`,
      `Your website has a page for each, so the profile would match the site.`,
    ],
    change: {
      field: "Categories",
      before: "Dentist, Cosmetic dentist",
      after: "Dentist, Cosmetic dentist, Emergency dental service, Teeth whitening service",
    },
  },
  {
    id: "s_kw_emergency",
    kind: "keyword",
    helps: "keywords",
    title: "Track “emergency dentist austin”",
    why: `${r1.name} is first on the map for this and you don't track it.`,
    evidence: [
      `1,900 searches a month in Austin.`,
      `${r1.name} and ${r2.name} both rank for it.`,
      `You offer it: mapleandmaindental.com/emergency.`,
    ],
    track: "emergency dentist austin",
    volume: 1900,
  },
  {
    id: "s_post",
    kind: "post",
    helps: "maps",
    title: "Post about Saturday appointments",
    why: `Your last Google post was 11 weeks ago. ${r1.name} posts every week.`,
    evidence: [
      `${r1.name} posted ${r1.posts30d} times in the last 30 days; you posted ${you.posts30d}.`,
      `“Open Saturday” comes up in 9 of your recent reviews.`,
    ],
    draft:
      "Toothache on a Saturday? We're open 8–2 every Saturday at 1204 S Congress Ave, and we keep same-day slots for emergencies. Call (512) 555-0142 or book online.",
  },
  {
    id: "s_p_emergency",
    kind: "prompt",
    helps: "ai",
    title: "Track “Who is the best emergency dentist in Austin open on Saturday?”",
    why: "People ask AI in full questions. This one fits a service you offer and nobody else nearby is open Saturdays.",
    evidence: [
      `Built from your services (emergency visits) and your hours (Saturday 8–2).`,
      `${r2.name} is named in similar answers today.`,
    ],
    track: "Who is the best emergency dentist in Austin open on Saturday?",
  },
  {
    id: "s_desc",
    kind: "profile",
    helps: "maps",
    title: "Mention emergencies and Saturdays in your description",
    why: "Your description doesn't say the two things people search for most.",
    evidence: [
      `“emergency” and “Saturday” are in ${r1.name}'s and ${r2.name}'s descriptions, not in yours.`,
      `Both words are in your tracked or suggested keywords.`,
    ],
    change: {
      field: "Description",
      before: "Maple & Main Dental is a family dental practice on South Congress offering cleanings, fillings and cosmetic dentistry.",
      after:
        "Maple & Main Dental is a family dental practice on South Congress. Cleanings, fillings, teeth whitening and same-day emergency visits. Open Saturdays 8–2.",
    },
  },
  {
    id: "s_kw_invisalign",
    kind: "keyword",
    helps: "keywords",
    title: "Track “invisalign austin”",
    why: "Two competitors rank for it and it is worth more per patient than a cleaning.",
    evidence: [
      `2,400 searches a month in Austin.`,
      `${r1.name} is 4th and ${r3.name} is 7th on Google.`,
      `You offer it: mapleandmaindental.com/invisalign.`,
    ],
    track: "invisalign austin",
    volume: 2400,
  },
  {
    id: "s_p_nervous",
    kind: "prompt",
    helps: "ai",
    title: "Track “Which Austin dentist is good for nervous patients?”",
    why: "Your reviews mention it more than anyone's, so this is a question you can win.",
    evidence: [`“gentle”, “nervous” or “anxious” appear in 31 of your ${business.reviews} reviews.`, `${r3.name} is named for it today.`],
    track: "Which Austin dentist is good for nervous patients?",
  },
];

/** What isn't on this page yet, in the order it would be added. */
export const later = [
  "Articles: suggest, write and publish to the website",
  "Website fixes: find problems and fix them",
  "Search Console and Analytics: clicks and calls behind each keyword",
  "Posts to Facebook and Instagram",
];

// ---------- Adding by hand ----------

/** Offered when adding AI questions by hand: from your services, hours and what your reviews mention. */
export const questionIdeas: string[] = [
  "Who is the best emergency dentist in Austin open on Saturday?",
  "Which Austin dentist is good for nervous patients?",
  "How much does teeth whitening cost in Austin?",
  "Which dentists near South Congress take Delta Dental?",
  "Who does Invisalign in South Austin?",
];

/** A business found when searching Google Maps to add a competitor by hand. */
export type Candidate = {
  id: string;
  name: string;
  category: string;
  address: string;
  rating: number;
  reviews: number;
  distanceMi: number;
};

/** Google Maps businesses near you that aren't among the competitors found automatically. Real build: one Maps search. */
export const candidates: Candidate[] = [
  {
    id: "n1",
    name: "Mueller Family Dental",
    category: "Dentist",
    address: "1801 E 51st St, Austin",
    rating: 4.8,
    reviews: 402,
    distanceMi: 5.9,
  },
  {
    id: "n2",
    name: "Smile Austin Dentistry",
    category: "Cosmetic dentist",
    address: "3801 S Lamar Blvd, Austin",
    rating: 4.6,
    reviews: 158,
    distanceMi: 2.4,
  },
  {
    id: "n3",
    name: "Bouldin Creek Dental",
    category: "Dentist",
    address: "1500 S 1st St, Austin",
    rating: 4.9,
    reviews: 87,
    distanceMi: 0.7,
  },
  {
    id: "n4",
    name: "Aspen Dental — South Austin",
    category: "Dentist",
    address: "4301 W William Cannon Dr, Austin",
    rating: 4.3,
    reviews: 911,
    distanceMi: 6.8,
  },
  {
    id: "n5",
    name: "Austin Kids Dentistry",
    category: "Pediatric dentist",
    address: "2700 W Anderson Ln, Austin",
    rating: 4.9,
    reviews: 633,
    distanceMi: 7.5,
  },
];

// AI answer visibility: do ChatGPT, Gemini, Perplexity, Claude and Google's AI
// answers recommend you when someone asks for a local business? Mock data,
// shaped like DataForSEO's AI Optimization API (LLM Scraper / LLM Responses)
// plus the ai_overview item in Google organic SERP results.

import { business, competitors } from "./mock";
import type { Market, Prospect } from "./prospects";

function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const hash = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return Math.abs(h); };

export type EngineId = "chatgpt" | "gemini" | "perplexity" | "claude" | "aio" | "aimode";
export const engines: { id: EngineId; name: string; api: string; reach: number }[] = [
  { id: "chatgpt", name: "ChatGPT", api: "AI Optimization · chat_gpt/llm_scraper", reach: 0.82 },
  { id: "aio", name: "AI Overviews", api: "SERP · google/organic (ai_overview item)", reach: 0.68 },
  { id: "gemini", name: "Gemini", api: "AI Optimization · gemini/llm_scraper", reach: 0.55 },
  { id: "aimode", name: "AI Mode", api: "SERP · google AI Mode (verify endpoint)", reach: 0.5 },
  { id: "perplexity", name: "Perplexity", api: "AI Optimization · perplexity/llm_responses", reach: 0.6 },
  { id: "claude", name: "Claude", api: "AI Optimization · claude/llm_responses", reach: 0.45 },
];

// Sites AI answers lean on for local picks. `you` = whether Maple & Main has a listing there.
export const aiSources: { domain: string; label: string; you: boolean; citationId?: string }[] = [
  { domain: "yelp.com", label: "Yelp", you: true, citationId: "yelp" },
  { domain: "healthgrades.com", label: "Healthgrades", you: false, citationId: "healthgrades" },
  { domain: "reddit.com", label: "Reddit (r/Austin)", you: false },
  { domain: "zocdoc.com", label: "Zocdoc", you: false, citationId: "zocdoc" },
  { domain: "austinmonthly.com", label: "Austin Monthly “Top Dentists”", you: false },
  { domain: "google.com/maps", label: "Google Business Profile", you: true, citationId: "google" },
  { domain: "bbb.org", label: "BBB", you: true, citationId: "bbb" },
  { domain: "brightsmileatx.com", label: "Bright Smile Austin (site)", you: false },
  { domain: business.website, label: "Your website", you: true },
];

const otherPicks = ["Castle Dental", "Austin Dental Works", "Aspen Dental — Austin", "Lamar Smiles"];

export type AiAnswer = { engine: EngineId; listed: string[]; position: number | null; sources: string[]; excerpt: string };
export type AiPrompt = { id: string; text: string; keywordId: string; answers: AiAnswer[]; history: number[] };

const promptTexts: [string, string][] = [
  ["Who is the best dentist in Austin?", "kw_1"],
  ["I need an emergency dentist in Austin today. Who's open?", "kw_3"],
  ["Where can I get Invisalign in South Austin?", "kw_5"],
  ["Best cosmetic dentist near South Congress", "kw_8"],
  ["Kid-friendly dentist in 78704", "kw_6"],
  ["Who's good for dental implants in Austin and what do they cost?", "kw_7"],
  ["Dentist near me that takes walk-ins", "kw_2"],
  ["Affordable teeth whitening in Austin", "kw_4"],
];

function answerFor(prompt: string, engine: EngineId, youChance: number): AiAnswer {
  const r = rng(hash(prompt + engine));
  const rivals = competitors.filter((c) => !c.isYou).sort(() => r() - 0.5).map((c) => c.name);
  const pool = [...rivals.slice(0, 3), ...[...otherPicks].sort(() => r() - 0.5).slice(0, 2)];
  const count = 3 + Math.floor(r() * 3);
  let listed = pool.slice(0, count);
  const inIt = r() < youChance;
  if (inIt) {
    const at = Math.floor(r() * Math.min(count, 4));
    listed = [...listed.slice(0, at), business.name, ...listed.slice(at)].slice(0, count);
  }
  const position = listed.indexOf(business.name);
  const sources = aiSources.filter(() => r() > 0.55).map((s) => s.domain).slice(0, 4);
  if (!sources.length) sources.push("yelp.com");
  const top = listed[0];
  const excerpt = inIt
    ? position === 0
      ? `…${business.name} on South Congress is a strong pick, with 4.7★ from 212 reviews. ${listed[1]} is also well reviewed…`
      : `…${top} is consistently rated highly, and ${business.name} on South Congress is another strong option with 4.7★ from 212 reviews…`
    : `…Top picks: ${listed.slice(0, 3).join(", ")}. ${top} is often mentioned on Yelp and Healthgrades for its reviews…`;
  return { engine, listed, position: position >= 0 ? position + 1 : null, sources, excerpt };
}

export const aiPrompts: AiPrompt[] = promptTexts.map(([text, keywordId], i) => {
  const r = rng(hash(text));
  const base = 0.25 + r() * 0.35;
  const answers = engines.map((e) => answerFor(text, e.id, base * (e.id === "aio" || e.id === "aimode" ? 1.25 : e.id === "claude" ? 0.6 : 1)));
  const mentions = answers.filter((a) => a.position !== null).length;
  const history = Array.from({ length: 8 }, (_, w) => Math.max(0, Math.min(6, Math.round(mentions - 1.5 + (w / 7) * 1.5 + (r() - 0.5)))));
  history[7] = mentions;
  return { id: `ai_${i + 1}`, text, keywordId, answers, history };
});

/** Share of answers (prompt × engine) that mention the business. */
export function aiVisibility(prompts = aiPrompts) {
  const all = prompts.flatMap((p) => p.answers);
  const hit = all.filter((a) => a.position !== null);
  const byEngine = engines.map((e) => {
    const xs = all.filter((a) => a.engine === e.id);
    return { ...e, mentioned: xs.filter((a) => a.position !== null).length, total: xs.length };
  });
  const prevHits = prompts.reduce((a, p) => a + p.history[3], 0);
  const sov = new Map<string, number>();
  all.forEach((a) => a.listed.forEach((n) => sov.set(n, (sov.get(n) ?? 0) + 1)));
  const sourceCounts = new Map<string, number>();
  all.forEach((a) => a.sources.forEach((s) => sourceCounts.set(s, (sourceCounts.get(s) ?? 0) + 1)));
  return {
    pct: (hit.length / all.length) * 100,
    prevPct: (prevHits / all.length) * 100,
    avgPos: hit.length ? hit.reduce((x, a) => x + (a.position ?? 0), 0) / hit.length : null,
    hits: hit.length,
    total: all.length,
    byEngine,
    shareOfVoice: [...sov.entries()].map(([name, n]) => ({ name, n, pct: (n / all.length) * 100 })).sort((a, b) => b.n - a.n),
    sources: aiSources.map((s) => ({ ...s, n: sourceCounts.get(s.domain) ?? 0, pct: ((sourceCounts.get(s.domain) ?? 0) / all.length) * 100 })).sort((a, b) => b.n - a.n),
    weekly: Array.from({ length: 8 }, (_, w) => (prompts.reduce((a, p) => a + p.history[w], 0) / all.length) * 100),
  };
}

/** For sales audits: one plain question asked of each engine about a prospect's market. */
export function prospectAi(p: Prospect, m: Market) {
  const q = `Who's the best ${m.keyword} in ${m.city.split(",")[0]}?`;
  const leaders = m.prospects.filter((x) => x.mapRank !== null && x.mapRank <= 5 && x.id !== p.id).map((x) => x.name);
  return {
    question: q,
    answers: engines.map((e) => {
      const r = rng(hash(p.id + m.keyword + e.id));
      const chance = p.mapRank === null ? 0.05 : p.mapRank <= 3 ? 0.7 : p.mapRank <= 10 ? 0.22 : 0.08;
      const listed = leaders.slice(0, 3).sort(() => r() - 0.5);
      const mentioned = r() < chance * (p.site ? 1 : 0.5);
      if (mentioned) listed.splice(Math.floor(r() * 3), 0, p.name);
      return { engine: e, mentioned, listed: listed.slice(0, 3) };
    }),
  };
}

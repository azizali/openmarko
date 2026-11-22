// DataForSEO: Google Maps, Google search and AI answers (two steps: post, collect) and keyword data (at once).
// Live calls follow DataForSEO's v3 API; they have not been run against a real account in this repository yet, so
// parsing is defensive and a shape we don't recognise is a failed task, not a crash. The stub answers from
// stub-world.ts and costs what the live call would (unit prices below), so cost pages read true in development.
//
// Prices (USD per request, standard queue, Sep 2026; check GET /v3/appendix/user_data): Maps 0.0006, organic 0.0006,
// ChatGPT scraper 0.0012, AI Overview via organic 0.0012, Perplexity ~0.04 (live only), search volume 0.09 per
// request (up to 1,000 keywords), Labs 0.012 + 0.00012 per row. Priority doubles the SERP price.

import { AppError } from "@app/kernel";
import type { CapabilityId } from "@app/shared";
import type { Adapter, CallContext, CallResult } from "../types";
import {
  domainOf,
  type AiQuery,
  type AiResult,
  type Collected,
  type CollectInput,
  type KeywordIdea,
  type KeywordMetric,
  type KeywordsInput,
  type MapsItem,
  type MapsQuery,
  type OrganicQuery,
  type OrganicResult,
  type Posted,
  type PostInput,
  type SearchInput,
} from "./contract";
import { stubAi, stubIdeas, stubMaps, stubOrganic, stubVolume } from "./stub-world";

const BASE = "https://api.dataforseo.com/v3";
const micros = (usd: number) => Math.round(usd * 1_000_000);

/** What one request costs, by capability (and engine), on the standard queue. */
export const unitPriceUsd = {
  maps: 0.0006,
  organic: 0.0006,
  ai: { chatgpt: 0.0012, google_ai: 0.0012, perplexity: 0.04 },
  volume: 0.09,
  labsTask: 0.012,
  labsRow: 0.00012,
} as const;

type Kind = "maps" | "organic" | "ai";
const kindOf: Partial<Record<CapabilityId, Kind>> = { "search.maps": "maps", "search.organic": "organic", "search.ai": "ai" };

function priceOf(kind: Kind, query: unknown, priority: boolean): number {
  const usd = kind === "ai" ? unitPriceUsd.ai[(query as AiQuery).engine] : unitPriceUsd[kind];
  return micros(usd * (priority && kind !== "ai" ? 2 : 1));
}

// ---------- HTTP ----------

type Envelope = { status_code: number; status_message: string; cost?: number; tasks?: Task[] };
type Task = {
  id: string;
  status_code: number;
  status_message: string;
  cost?: number;
  data?: Record<string, unknown>;
  result?: any[] | null;
};

async function request(c: CallContext, method: "GET" | "POST", path: string, body?: unknown): Promise<Envelope> {
  const login = c.settings.login;
  const { password } = await c.secrets();
  if (!login || !password) throw new AppError(409, "needs_connection", "DataForSEO needs its login and password.");
  const res = await fetch(`${BASE}/${path}`, {
    method,
    headers: { authorization: `Basic ${btoa(`${login}:${password}`)}`, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) throw new AppError(502, "provider_failed", `DataForSEO answered ${res.status}.`);
  const json = (await res.json()) as Envelope;
  if (json.status_code !== 20000) throw new AppError(502, "provider_failed", `DataForSEO: ${json.status_message}`);
  return json;
}

// ---------- Posting tasks ----------

const coordinate = (q: { at: { lat: number; lng: number } }, suffix: string) => `${q.at.lat.toFixed(7)},${q.at.lng.toFixed(7)},${suffix}`;

/** The endpoint and body for one query. Google AI answers are a Google search with its AI Overview loaded. */
function taskFor(kind: Kind, query: any, priority: boolean): { path: string; body: Record<string, unknown> } | { live: true } {
  const common = { language_code: query.languageCode, priority: priority ? 2 : 1 };
  if (kind === "maps") {
    const q = query as MapsQuery;
    return {
      path: "serp/google/maps",
      body: { ...common, keyword: q.keyword, location_coordinate: coordinate(q, `${q.zoom}z`), depth: q.depth },
    };
  }
  if (kind === "organic") {
    const q = query as OrganicQuery;
    return {
      path: "serp/google/organic",
      body: { ...common, keyword: q.keyword, location_coordinate: coordinate(q, "1000"), depth: q.depth, load_async_ai_overview: true },
    };
  }
  const q = query as AiQuery;
  if (q.engine === "perplexity") return { live: true };
  if (q.engine === "google_ai")
    return {
      path: "serp/google/organic",
      body: { ...common, keyword: q.question, location_coordinate: coordinate(q, "1000"), depth: 10, load_async_ai_overview: true },
    };
  return {
    path: "ai_optimization/chat_gpt/llm_scraper",
    body: { language_code: q.languageCode, keyword: q.question, location_coordinate: coordinate(q, "1000") },
  };
}

/** Live-only engines are answered as they're posted; their id is ours, their result comes back with it. */
async function postLive(c: CallContext, kind: Kind, tag: string, query: AiQuery): Promise<Posted<AiResult>> {
  const json = await request(c, "POST", "ai_optimization/perplexity/llm_responses/live", [
    { user_prompt: query.question, model_name: "sonar", web_search: true },
  ]);
  const task = json.tasks?.[0];
  if (!task || task.status_code !== 20000) throw new AppError(502, "provider_failed", `DataForSEO: ${task?.status_message ?? "no task"}`);
  return { tag, externalId: `live_${task.id}`, costMicros: micros(task.cost ?? 0), result: parseAi("perplexity", task) };
}

async function post(kind: Kind, input: PostInput<unknown>, c: CallContext): Promise<CallResult<{ posted: Posted<unknown>[] }>> {
  const priority = input.queue === "priority";
  if (c.mode === "stub") {
    const posted = input.queries.map(({ tag, query }) => ({
      tag,
      externalId: `stub_${crypto.randomUUID()}`,
      costMicros: priceOf(kind, query, priority),
    }));
    return { output: { posted }, quantity: posted.length, costMicros: posted.reduce((n, p) => n + p.costMicros, 0) };
  }
  const posted: Posted<unknown>[] = [];
  // Grouped by endpoint: one request takes up to 100 tasks.
  const groups = new Map<string, { tag: string; body: Record<string, unknown> }[]>();
  for (const { tag, query } of input.queries) {
    const t = taskFor(kind, query, priority);
    if ("live" in t) {
      posted.push(await postLive(c, kind, tag, query as AiQuery));
      continue;
    }
    const body = { ...t.body, tag, ...(input.pingbackUrl ? { pingback_url: input.pingbackUrl.replace("{id}", "$id") } : {}) };
    groups.set(t.path, [...(groups.get(t.path) ?? []), { tag, body }]);
  }
  for (const [path, tasks] of groups)
    for (let i = 0; i < tasks.length; i += 100) {
      const json = await request(
        c,
        "POST",
        `${path}/task_post`,
        tasks.slice(i, i + 100).map((t) => t.body),
      );
      for (const task of json.tasks ?? []) {
        if (task.status_code !== 20100) throw new AppError(502, "provider_failed", `DataForSEO refused a task: ${task.status_message}`);
        posted.push({ tag: String(task.data?.tag ?? ""), externalId: `${path}|${task.id}`, costMicros: micros(task.cost ?? 0) });
      }
    }
  return { output: { posted }, quantity: posted.length, costMicros: posted.reduce((n, p) => n + p.costMicros, 0) };
}

// ---------- Collecting results ----------

const PENDING = new Set([40601, 40602]); // handed to a worker; in the queue

async function collect(kind: Kind, input: CollectInput<unknown>, c: CallContext): Promise<CallResult<{ collected: Collected<unknown>[] }>> {
  if (c.mode === "stub") {
    const collected = input.tasks.map(({ externalId, query }) => ({
      externalId,
      status: "ready" as const,
      result: stubAnswer(kind, query),
    }));
    return { output: { collected }, quantity: 0, costMicros: 0 };
  }
  const collected: Collected<unknown>[] = [];
  for (const { externalId, query } of input.tasks) {
    const [path, id] = externalId.split("|");
    if (!path || !id) {
      collected.push({ externalId, status: "failed", error: "Not a task we posted." });
      continue;
    }
    const json = await request(c, "GET", `${path}/task_get/advanced/${id}`);
    const task = json.tasks?.[0];
    if (!task || PENDING.has(task.status_code)) collected.push({ externalId, status: "pending" });
    else if (task.status_code !== 20000) collected.push({ externalId, status: "failed", error: task.status_message });
    else {
      const result =
        kind === "maps" ? { items: parseMaps(task) } : kind === "organic" ? parseOrganic(task) : parseAi((query as AiQuery).engine, task);
      collected.push({ externalId, status: "ready", result });
    }
  }
  return { output: { collected }, quantity: 0, costMicros: 0 };
}

function stubAnswer(kind: Kind, query: unknown) {
  if (kind === "maps") return { items: stubMaps(query as MapsQuery) };
  if (kind === "organic") return stubOrganic(query as OrganicQuery);
  return stubAi(query as AiQuery);
}

// ---------- Parsing (defensive: DataForSEO adds fields often) ----------

const items = (task: Task): any[] => (task.result?.[0]?.items as any[] | null | undefined) ?? [];
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

function parseMaps(task: Task): MapsItem[] {
  return items(task)
    .filter((i) => i.type === "maps_search")
    .map((i, n) => ({
      position: num(i.rank_group) ?? n + 1,
      placeId: str(i.place_id),
      cid: str(i.cid),
      name: str(i.title) ?? "Unnamed business",
      domain: domainOf(str(i.domain) ?? str(i.url)),
      category: str(i.category),
      categories: [str(i.category), ...((i.additional_categories as unknown[]) ?? []).map(str)].filter((x): x is string => !!x),
      rating: num(i.rating?.value),
      reviewCount: num(i.rating?.votes_count),
      isClaimed: typeof i.is_claimed === "boolean" ? i.is_claimed : null,
      address: str(i.address),
      lat: num(i.latitude),
      lng: num(i.longitude),
      phone: str(i.phone),
    }));
}

function parseOrganic(task: Task): OrganicResult {
  const all = items(task);
  const overview = all.find((i) => i.type === "ai_overview");
  return {
    items: all
      .filter((i) => i.type === "organic")
      .map((i, n) => ({
        position: num(i.rank_group) ?? n + 1,
        domain: domainOf(str(i.domain) ?? str(i.url)) ?? "",
        url: str(i.url) ?? "",
        title: str(i.title) ?? "",
      }))
      .filter((i) => i.domain),
    mapPack: all.some((i) => i.type === "local_pack" || i.type === "map"),
    aiOverview: { shown: !!overview, citedDomains: referencesOf(overview).map((r) => r.domain) },
    peopleAlsoAsk: all
      .filter((i) => i.type === "people_also_ask")
      .flatMap((i) => (i.items as any[] | undefined) ?? [])
      .map((q) => str(q.title))
      .filter((x): x is string => !!x),
  };
}

function referencesOf(node: any): { domain: string; url: string }[] {
  const out = new Map<string, { domain: string; url: string }>();
  const walk = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(walk);
    const url = str(n.url);
    const domain = domainOf(str(n.domain) ?? url);
    if (url && domain && !out.has(domain)) out.set(domain, { domain, url });
    for (const k of ["references", "sources", "annotations", "items", "sections"]) walk(n[k]);
  };
  walk(node);
  return [...out.values()];
}

function textOf(node: any): string {
  if (!node || typeof node !== "object") return "";
  if (Array.isArray(node)) return node.map(textOf).filter(Boolean).join("\n");
  const own = str(node.markdown) ?? str(node.text) ?? "";
  return own || textOf(node.items ?? node.sections ?? []);
}

function parseAi(engine: AiQuery["engine"], task: Task): AiResult {
  const result = task.result?.[0] ?? {};
  const node = engine === "google_ai" ? items(task).find((i) => i.type === "ai_overview") : result;
  const text = textOf(node)
    .replace(/[*_#>`]/g, "")
    .replace(/\[(.*?)\]\([^)]*\)/g, "$1")
    .trim();
  return { text, citations: referencesOf(node) };
}

// ---------- Keyword data ----------

/** DataForSEO's location codes for the countries we expect first; others fall back to the United States. */
const countryCodes: Record<string, number> = {
  US: 2840,
  GB: 2826,
  CA: 2124,
  AU: 2036,
  IE: 2372,
  NZ: 2554,
  IN: 2356,
  DE: 2276,
  FR: 2250,
  ES: 2724,
};
const locationCode = (country: string) => countryCodes[country.toUpperCase()] ?? 2840;

async function keywords(
  input: KeywordsInput,
  c: CallContext,
): Promise<CallResult<{ metrics: KeywordMetric[] } | { ideas: KeywordIdea[] }>> {
  if (input.op === "volume") {
    const terms = [...new Set(input.terms.map((t) => t.trim().toLowerCase()).filter(Boolean))];
    if (!terms.length) return { output: { metrics: [] }, quantity: 0, costMicros: 0 };
    const requests = Math.ceil(terms.length / 1000);
    if (c.mode === "stub")
      return { output: { metrics: terms.map(stubVolume) }, quantity: requests, costMicros: micros(unitPriceUsd.volume * requests) };
    const metrics: KeywordMetric[] = [];
    let cost = 0;
    for (let i = 0; i < terms.length; i += 1000) {
      const json = await request(c, "POST", "keywords_data/google_ads/search_volume/live", [
        { keywords: terms.slice(i, i + 1000), location_code: locationCode(input.countryCode), language_code: input.languageCode },
      ]);
      cost += json.cost ?? 0;
      for (const r of json.tasks?.[0]?.result ?? [])
        metrics.push({
          term: String(r.keyword),
          monthlySearches: num(r.search_volume),
          cpc: num(r.cpc),
          competition: num(r.competition_index) === null ? null : r.competition_index / 100,
          trend: ((r.monthly_searches as any[] | null) ?? [])
            .slice(0, 12)
            .reverse()
            .map((m) => num(m.search_volume) ?? 0),
        });
    }
    return { output: { metrics }, quantity: requests, costMicros: micros(cost) };
  }

  const seeds = input.seeds.map((s) => s.trim()).filter(Boolean);
  const requests = (input.domain ? 1 : 0) + seeds.length;
  if (c.mode === "stub") {
    const ideas = stubIdeas(input.domain, seeds, input.limit);
    return {
      output: { ideas },
      quantity: requests,
      costMicros: micros(unitPriceUsd.labsTask * requests + unitPriceUsd.labsRow * ideas.length),
    };
  }
  const common = { location_code: locationCode(input.countryCode), language_code: input.languageCode, limit: input.limit };
  const ideas = new Map<string, KeywordIdea>();
  let cost = 0;
  if (input.domain) {
    const json = await request(c, "POST", "dataforseo_labs/google/ranked_keywords/live", [{ ...common, target: input.domain }]);
    cost += json.cost ?? 0;
    for (const i of items(json.tasks?.[0] ?? ({} as Task))) {
      const term = str(i.keyword_data?.keyword);
      if (term)
        ideas.set(term, {
          term,
          monthlySearches: num(i.keyword_data?.keyword_info?.search_volume),
          position: num(i.ranked_serp_element?.serp_item?.rank_group),
        });
    }
  }
  for (const seed of seeds) {
    const json = await request(c, "POST", "dataforseo_labs/google/keyword_suggestions/live", [{ ...common, keyword: seed }]);
    cost += json.cost ?? 0;
    for (const i of items(json.tasks?.[0] ?? ({} as Task))) {
      const term = str(i.keyword);
      if (term && !ideas.has(term)) ideas.set(term, { term, monthlySearches: num(i.keyword_info?.search_volume), position: null });
    }
  }
  return { output: { ideas: [...ideas.values()].slice(0, input.limit) }, quantity: requests, costMicros: micros(cost) };
}

export const dataforseo: Adapter = {
  provider: "dataforseo",
  capabilities: ["search.maps", "search.organic", "search.ai", "search.keywords"],
  estimate: (capability, input) => (capability === "search.keywords" ? 1 : input?.op === "post" ? (input.queries?.length ?? 1) : 0),
  call: async (capability, input, c) => {
    if (capability === "search.keywords") return keywords(input as KeywordsInput, c);
    const kind = kindOf[capability];
    if (!kind) throw new AppError(501, "not_implemented", `DataForSEO doesn't do ${capability}.`);
    const i = input as SearchInput<unknown>;
    return i.op === "post" ? post(kind, i, c) : collect(kind, i, c);
  },
};

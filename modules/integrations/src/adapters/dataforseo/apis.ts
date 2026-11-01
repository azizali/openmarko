// The DataForSEO APIs we consume, one section each. Every function maps DataForSEO's response to the
// capability's output type (seo-data.ts), so nothing outside this folder sees DataForSEO's shapes.
// Adding an API = a function here, and a capability case in index.ts.
import { AppError } from "@openmarko/kernel";
import { namesMentioned, type AiAnswer, type KeywordIdea, type MapResult, type OrganicResult, type ReferringDomain } from "../../seo-data";
import { dfsPost, type DfsCredentials } from "./client";

type Out<T> = { output: T; costMicros: number };
const US = 2840;

/** Where a search happens: an exact point ("lat,lng,zoom") or a location code (defaults to the US). */
const where = (coordinate?: string) => (coordinate ? { location_coordinate: coordinate } : { location_code: US });

/** SERP API: live Google results. */
export const serp = {
  async organic(c: DfsCredentials, keyword: string, coordinate: string | undefined, f?: typeof fetch): Promise<Out<OrganicResult[]>> {
    const { result, costMicros } = await dfsPost<{ items?: { type: string; rank_absolute: number; domain: string; url: string }[] }>(
      c,
      "serp/google/organic/live/advanced",
      { keyword, language_code: "en", depth: 10, ...where(coordinate) },
      f,
    );
    const items = (result[0]?.items ?? []).filter((i) => i.type === "organic");
    return { output: items.map((i) => ({ rank: i.rank_absolute, domain: i.domain.replace(/^www\./, ""), url: i.url })), costMicros };
  },

  async maps(c: DfsCredentials, keyword: string, coordinate: string | undefined, f?: typeof fetch): Promise<Out<MapResult[]>> {
    const { result, costMicros } = await dfsPost<{ items?: { rank_group: number; title: string }[] }>(
      c,
      "serp/google/maps/live/advanced",
      { keyword, language_code: "en", depth: 20, ...where(coordinate) },
      f,
    );
    return { output: (result[0]?.items ?? []).map((i) => ({ rank: i.rank_group, name: i.title })), costMicros };
  },
};

/** DataForSEO Labs API: keyword research from their own index. */
export const labs = {
  async keywordIdeas(c: DfsCredentials, seed: string, f?: typeof fetch): Promise<Out<KeywordIdea[]>> {
    const { result, costMicros } = await dfsPost<{
      items?: {
        keyword: string;
        keyword_info?: { search_volume?: number | null };
        keyword_properties?: { keyword_difficulty?: number | null };
      }[];
    }>(c, "dataforseo_labs/google/keyword_ideas/live", { keywords: [seed], location_code: US, language_code: "en", limit: 50 }, f);
    return {
      output: (result[0]?.items ?? []).map((i) => ({
        term: i.keyword,
        volume: i.keyword_info?.search_volume ?? null,
        kd: i.keyword_properties?.keyword_difficulty ?? null,
      })),
      costMicros,
    };
  },
};

/** Backlinks API: sites that link to a domain. */
export const backlinks = {
  async referringDomains(c: DfsCredentials, domain: string, f?: typeof fetch): Promise<Out<ReferringDomain[]>> {
    const { result, costMicros } = await dfsPost<{ items?: { domain: string; first_seen?: string | null }[] }>(
      c,
      "backlinks/referring_domains/live",
      { target: domain, limit: 100, order_by: ["rank,desc"] },
      f,
    );
    return {
      output: (result[0]?.items ?? []).map((i) => ({ domain: i.domain, url: `https://${i.domain}/`, firstSeen: i.first_seen ?? null })),
      costMicros,
    };
  },
};

/** AI Optimization API: what AI assistants answer. `engine` picks the assistant. */
export const aiOptimization = {
  async answer(c: DfsCredentials, engine: string, prompt: string, names: string[], f?: typeof fetch): Promise<Out<AiAnswer>> {
    const paths: Record<string, string> = {
      chatgpt: "ai_optimization/chat_gpt/llm_scraper/live/advanced",
      gemini: "ai_optimization/gemini/llm_scraper/live/advanced",
    };
    const path = paths[engine];
    if (!path) throw new AppError(422, "invalid", `No DataForSEO AI engine called "${engine}".`);
    const { result, costMicros } = await dfsPost<{ markdown?: string; items?: { text?: string; markdown?: string }[] }>(
      c,
      path,
      { keyword: prompt, location_code: US, language_code: "en" },
      f,
    );
    const r = result[0];
    const text = r?.markdown ?? (r?.items ?? []).map((i) => i.markdown ?? i.text ?? "").join("\n");
    return { output: { text, listed: namesMentioned(text, names) }, costMicros };
  },
};

/**
 * On-Page API crawls are asynchronous: post a task, then collect it when DataForSEO calls back. That needs the
 * postback job, which isn't built yet, so a live site.crawl says so instead of pretending.
 */
export const onPage = {
  async crawl(): Promise<never> {
    throw new AppError(501, "not_implemented", "Live site crawls need DataForSEO's On-Page postback job, which isn't built yet.");
  },
};

import type { Adapter } from "../types";
import { AppError } from "@openmarko/kernel";
import { stubCrawl, stubKeywordIdeas, stubLlmAnswer, stubReferringDomains, stubSerpMaps, stubSerpOrganic } from "../stubs";
import { aiOptimization, backlinks, labs, onPage, serp } from "./apis";
import type { DfsCredentials } from "./client";

/** Stub cost per request, in micros (rough published prices). Live calls use the cost DataForSEO reports. */
const STUB_COST = { serp: 600, keywords: 1200, crawl: 2000, backlinks: 2000, ai: 15000 };

/**
 * DataForSEO: several APIs behind the SEO data capabilities.
 *   serp.read → SERP API · keywords.research → DataForSEO Labs · backlinks.read → Backlinks · ai.visibility → AI
 *   Optimization · site.crawl → On-Page
 */
export const dataforseo: Adapter = {
  provider: "dataforseo",
  capabilities: ["serp.read", "keywords.research", "site.crawl", "ai.visibility", "backlinks.read"],
  estimate: () => 1,
  call: async (capability, input, { mode, secrets }) => {
    if (mode === "stub") return stub(capability, input);
    const s = await secrets();
    const creds: DfsCredentials = { login: s.login ?? "", password: s.password ?? "" };
    const r = await live(capability, input, creds);
    return { output: r.output, quantity: 1, costMicros: r.costMicros };
  },
};

async function live(capability: string, input: any, c: DfsCredentials): Promise<{ output: unknown; costMicros: number }> {
  switch (capability) {
    case "serp.read":
      return input.kind === "maps" ? serp.maps(c, input.keyword, input.coordinate) : serp.organic(c, input.keyword, input.coordinate);
    case "keywords.research":
      return labs.keywordIdeas(c, input.seed);
    case "backlinks.read":
      return backlinks.referringDomains(c, input.domain);
    case "ai.visibility":
      return aiOptimization.answer(c, input.engine ?? "chatgpt", input.prompt, input.names ?? []);
    case "site.crawl":
      return onPage.crawl();
    default:
      throw new AppError(501, "not_implemented", `${capability} is not available from DataForSEO.`);
  }
}

const done = <T>(output: T, costMicros: number) => ({ output, quantity: 1, costMicros });

function stub(capability: string, input: any) {
  switch (capability) {
    case "serp.read":
      return input.kind === "maps"
        ? done(stubSerpMaps(input.keyword, input.names ?? []), STUB_COST.serp)
        : done(stubSerpOrganic(input.keyword, input.domain), STUB_COST.serp);
    case "keywords.research":
      return done(stubKeywordIdeas(input.seed), STUB_COST.keywords);
    case "site.crawl":
      return done(stubCrawl(input.domain), STUB_COST.crawl);
    case "backlinks.read":
      return done(stubReferringDomains(input.domain), STUB_COST.backlinks);
    case "ai.visibility":
      return done(stubLlmAnswer(input.engine ?? "chatgpt", input.prompt, input.names ?? []), STUB_COST.ai);
    default:
      throw new AppError(501, "not_implemented", `${capability} is not available from DataForSEO.`);
  }
}

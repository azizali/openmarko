// What the SEO data capabilities return. Stubs and every live provider map to these shapes, so features read
// the same fields whatever is connected (ADR 0002). A provider's own response shape never leaves its adapter.

/** serp.read, kind "organic": one result in the top 10. */
export type OrganicResult = { rank: number; domain: string; url: string };
/** serp.read, kind "maps": one business in the local pack. */
export type MapResult = { rank: number; name: string };
/** keywords.research: one idea. `kd` is keyword difficulty 0–100, when known. */
export type KeywordIdea = { term: string; volume: number | null; kd: number | null };
/** backlinks.read: one site linking to the domain. */
export type ReferringDomain = { domain: string; url: string; firstSeen: string | null };
/** ai.visibility: what an AI assistant answered, and which of the given names it mentioned. */
export type AiAnswer = { text: string; listed: string[] };
/** site.crawl: pages seen and issues found on the whole domain. */
export type CrawlResult = {
  pages: string[];
  issues: { rule: string; severity: "high" | "medium" | "low"; url: string; detail: string }[];
};

/** Names from `names` that appear in an answer's text, case-insensitively. */
export const namesMentioned = (text: string, names: string[]) => names.filter((n) => text.toLowerCase().includes(n.toLowerCase()));

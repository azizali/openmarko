// Stub data for development, tests and the demo deploy (ADR 0013). Deterministic: the same input gives the
// same output, so tests can assert on it. Shapes match what the live adapters return.
import { createHash } from "node:crypto";
import type { AiAnswer, CrawlResult, KeywordIdea, MapResult, OrganicResult, ReferringDomain } from "../seo-data";

export const hashOf = (s: string) => createHash("sha256").update(s).digest();
export const rand = (seed: string, n: number) => hashOf(seed)[n % 32]! / 255;

export const stubSerpOrganic = (keyword: string, domain: string): OrganicResult[] => {
  const items = Array.from({ length: 10 }, (_, i) => {
    const d = i === Math.floor(rand(keyword, 1) * 10) ? domain : `competitor-${Math.floor(rand(keyword + i, 2) * 40)}.test`;
    return { rank: i + 1, domain: d, url: `https://${d}/` };
  });
  return items;
};

export const stubSerpMaps = (keyword: string, names: string[]): MapResult[] => {
  const start = Math.floor(rand(keyword, 3) * 3);
  return names.slice(start, start + 3).map((name, i) => ({ rank: i + 1, name }));
};

export const stubKeywordIdeas = (seed: string): KeywordIdea[] => [
  { term: `${seed} near me`, volume: 1600, kd: 42 },
  { term: `best ${seed}`, volume: 880, kd: 51 },
  { term: `${seed} cost`, volume: 390, kd: 28 },
];

export const stubCrawl = (domain: string): CrawlResult => ({
  pages: [`https://${domain}/`, `https://${domain}/services`, `https://${domain}/contact`],
  issues: [
    { rule: "title.missing", severity: "medium", url: `https://${domain}/contact`, detail: "Page has no title tag." },
    {
      rule: "meta.description.long",
      severity: "low",
      url: `https://${domain}/services`,
      detail: "Meta description is over 160 characters.",
    },
  ],
});

export const stubReferringDomains = (domain: string): ReferringDomain[] => [
  { domain: `directory-${domain.length}.test`, url: `https://directory-${domain.length}.test/listing`, firstSeen: "2026-10-01" },
  { domain: "local-news.test", url: "https://local-news.test/best-dentists", firstSeen: "2026-10-15" },
];

export const stubLlmAnswer = (engine: string, prompt: string, names: string[]): AiAnswer => {
  const pick = names.filter((_, i) => rand(engine + prompt, i + 5) > 0.4);
  return { text: `${engine} (stub): for "${prompt}" you could try ${pick.join(", ") || "a local provider"}.`, listed: pick };
};

// What the Local SEO section costs to run in DataForSEO calls, per Location per month. Pure functions over two
// editable inputs: the settings (how much is tracked, how often) and the unit prices. #/local/costs shows it.
//
// Prices are raw DataForSEO USD, before any markup, as OpenSEO's metering uses them
// (open-seo src/server/lib/dataforseo/pricing.ts and src/shared/{rank-tracking,ai-visibility}.ts,
// read from DataForSEO's account price table in Sep 2026). Re-check them against GET /v3/appendix/user_data.
//
// Competitors cost almost nothing extra: every Maps result lists the top 20 businesses at that spot, every
// Google result the top 10 sites, every AI answer the businesses it names. Only competitors' profile facts
// (rating, reviews, photos…) and the keywords their websites rank for are separate calls.

export type Frequency = "daily" | "weekly" | "biweekly" | "monthly";
export const frequencies: { id: Frequency; label: string; perMonth: number }[] = [
  { id: "daily", label: "Daily", perMonth: 30 },
  { id: "weekly", label: "Weekly", perMonth: 52 / 12 },
  { id: "biweekly", label: "Every 2 weeks", perMonth: 26 / 12 },
  { id: "monthly", label: "Monthly", perMonth: 1 },
];
export const perMonth = (f: Frequency) => frequencies.find((x) => x.id === f)!.perMonth;

export type Queue = "standard" | "priority" | "live";
export const queues: { id: Queue; label: string; wait: string }[] = [
  {
    id: "standard",
    label: "Standard",
    wait: "results in about 5 min, up to 45",
  },
  { id: "priority", label: "Priority", wait: "results in about 1 min" },
  { id: "live", label: "Live", wait: "results in a few seconds" },
];

export type AiEngine = "chatgpt" | "gemini" | "aio" | "aimode" | "perplexity" | "claude";
export const aiEngines: { id: AiEngine; label: string; how: string }[] = [
  {
    id: "chatgpt",
    label: "ChatGPT",
    how: "LLM Scraper: the answer a person sees in the app",
  },
  { id: "gemini", label: "Gemini", how: "LLM Scraper" },
  {
    id: "aio",
    label: "Google AI Overviews",
    how: "A Google search page plus loading its overview",
  },
  { id: "aimode", label: "Google AI Mode", how: "One AI Mode search" },
  {
    id: "perplexity",
    label: "Perplexity",
    how: "LLM Responses API, priced by tokens",
  },
  {
    id: "claude",
    label: "Claude",
    how: "LLM Responses API with web search, priced by tokens",
  },
];

export type Prices = {
  /** Google Maps SERP, one request per spot (up to 100 results). */
  maps: Record<Queue, number>;
  /** Google Organic SERP, standard queue: the first page of 10, and each page after it. */
  organicFirstPage: number;
  organicNextPage: number;
  /** One AI answer, per engine. */
  ai: Record<AiEngine, number>;
  /** Business Data: one Google profile's facts (rating, reviews, categories, photos). */
  profile: number;
  /** DataForSEO Labs: per request, plus per row returned. Used for competitors' ranked keywords and keyword ideas. */
  labsTask: number;
  labsRow: number;
  /** Keywords Data, Google Ads search volume: one request takes up to 1,000 keywords. */
  searchVolume: number;
};

export const defaultPrices: Prices = {
  maps: { standard: 0.0006, priority: 0.0012, live: 0.002 },
  organicFirstPage: 0.0006,
  organicNextPage: 0.00045,
  ai: {
    chatgpt: 0.0012,
    gemini: 0.0012,
    aio: 0.0012,
    aimode: 0.0012,
    perplexity: 0.04,
    claude: 0.18,
  },
  profile: 0.0054,
  labsTask: 0.012,
  labsRow: 0.00012,
  searchVolume: 0.09,
};

export type Settings = {
  locations: number;
  // Google Maps
  keywords: number;
  gridSize: number;
  mapsEvery: Frequency;
  mapsQueue: Queue;
  // Google search
  organicEvery: Frequency;
  /** How deep to read: 10 is the first page; 100 finds you on page 2 to 10 too. */
  organicDepth: number;
  // AI answers
  questions: number;
  engines: AiEngine[];
  aiEvery: Frequency;
  /** Places the questions are asked from. 1 is the business's own address; more is an AI grid. */
  aiPlaces: number;
  // Competitors
  competitorProfiles: number;
  profilesEvery: Frequency;
  competitorSites: number;
  rankedRows: number;
  // Keyword research
  ideaRequests: number;
  ideaRows: number;
};

export const defaultSettings: Settings = {
  locations: 1,
  keywords: 10,
  gridSize: 7,
  mapsEvery: "weekly",
  mapsQueue: "priority",
  organicEvery: "weekly",
  organicDepth: 100,
  questions: 5,
  engines: ["chatgpt", "aio", "perplexity"],
  aiEvery: "weekly",
  aiPlaces: 1,
  competitorProfiles: 10,
  profilesEvery: "monthly",
  competitorSites: 5,
  rankedRows: 200,
  ideaRequests: 2,
  ideaRows: 100,
};

export type Area = "maps" | "google" | "ai" | "competitors" | "research";
export const areas: { id: Area; label: string }[] = [
  { id: "maps", label: "Google Maps" },
  { id: "google", label: "Google search" },
  { id: "ai", label: "AI answers" },
  { id: "competitors", label: "Competitors" },
  { id: "research", label: "Keyword research" },
];

export type Line = {
  area: Area;
  what: string;
  endpoint: string;
  /** How the call count is worked out, in words. */
  how: string;
  calls: number;
  unit: number;
  /** Shown when this line's data comes free with another one. */
  free?: string;
};

const organicRead = (depth: number, p: Prices) => p.organicFirstPage + (Math.ceil(depth / 10) - 1) * p.organicNextPage;
const n = (x: number) => x.toLocaleString("en-US", { maximumFractionDigits: 1 });

/** Every DataForSEO call one Location makes in a month. */
export function lines(s: Settings, p: Prices): Line[] {
  const spots = s.gridSize * s.gridSize;
  const mapsRuns = perMonth(s.mapsEvery);
  const orgRuns = perMonth(s.organicEvery);
  const aiRuns = perMonth(s.aiEvery);
  const out: Line[] = [
    {
      area: "maps",
      what: "Map grid scans",
      endpoint: "serp/google/maps/task_post",
      how: `${s.keywords} keywords × ${spots} spots (${s.gridSize}×${s.gridSize}) × ${n(mapsRuns)} scans`,
      calls: s.keywords * spots * mapsRuns,
      unit: p.maps[s.mapsQueue],
    },
    {
      area: "maps",
      what: "Who else is on the map",
      endpoint: "same results",
      how: "Each spot's result lists the top 20 businesses",
      calls: 0,
      unit: 0,
      free: "Free with the grid scans",
    },
    {
      area: "google",
      what: "Google positions",
      endpoint: "serp/google/organic/task_post",
      how: `${s.keywords} keywords × ${n(orgRuns)} checks, ${s.organicDepth} results deep`,
      calls: s.keywords * orgRuns,
      unit: organicRead(s.organicDepth, p),
    },
    {
      area: "google",
      what: "Who else is on Google's first page",
      endpoint: "same results",
      how: "Every site in the results, directories included",
      calls: 0,
      unit: 0,
      free: "Free with the Google checks",
    },
    ...s.engines.map((e): Line => ({
      area: "ai",
      what: `${aiEngines.find((x) => x.id === e)!.label} answers`,
      endpoint:
        e === "perplexity" || e === "claude"
          ? "ai_optimization/llm_responses"
          : e === "aio" || e === "aimode"
            ? "serp/google/*"
            : "ai_optimization/llm_scraper",
      how: `${s.questions} questions × ${s.aiPlaces} place${s.aiPlaces > 1 ? "s" : ""} × ${n(aiRuns)} checks`,
      calls: s.questions * s.aiPlaces * aiRuns,
      unit: p.ai[e],
    })),
    {
      area: "ai",
      what: "Who AI names, and the sites it cites",
      endpoint: "same answers",
      how: "Read from each answer",
      calls: 0,
      unit: 0,
      free: "Free with the answers",
    },
    {
      area: "competitors",
      what: "Competitors' Google profiles",
      endpoint: "business_data/google/my_business_info",
      how: `${s.competitorProfiles} competitors + you × ${n(perMonth(s.profilesEvery))} checks`,
      calls: (s.competitorProfiles + 1) * perMonth(s.profilesEvery),
      unit: p.profile,
    },
    {
      area: "competitors",
      what: "Keywords their websites rank for",
      endpoint: "dataforseo_labs/google/ranked_keywords",
      how: `${s.competitorSites} websites, ${s.rankedRows} keywords each, monthly`,
      calls: s.competitorSites,
      unit: p.labsTask + s.rankedRows * p.labsRow,
    },
    {
      area: "research",
      what: "Search volumes",
      endpoint: "keywords_data/google_ads/search_volume",
      how: "All tracked and suggested keywords in one request, monthly",
      calls: 1,
      unit: p.searchVolume,
    },
    {
      area: "research",
      what: "Keyword ideas",
      endpoint: "dataforseo_labs/google/keyword_ideas",
      how: `${s.ideaRequests} requests × ${s.ideaRows} ideas, monthly`,
      calls: s.ideaRequests,
      unit: p.labsTask + s.ideaRows * p.labsRow,
    },
  ];
  return out;
}

export const lineCost = (l: Line) => l.calls * l.unit;

export function totals(s: Settings, p: Prices) {
  const ls = lines(s, p);
  const perLocation = ls.reduce((a, l) => a + lineCost(l), 0);
  const byArea = Object.fromEntries(
    areas.map((a) => [a.id, ls.filter((l) => l.area === a.id).reduce((x, l) => x + lineCost(l), 0)]),
  ) as Record<Area, number>;
  return {
    lines: ls,
    byArea,
    perLocation,
    perMonth: perLocation * s.locations,
    perYear: perLocation * s.locations * 12,
    calls: ls.reduce((a, l) => a + l.calls, 0) * s.locations,
    perKeyword: s.keywords ? (byArea.maps + byArea.google) / s.keywords : 0,
  };
}

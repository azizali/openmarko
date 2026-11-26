// What the SEO module asks a search-data provider, and what it gets back. Provider-neutral: the DataForSEO adapter
// translates these to its API, the stub answers them from a made-up market (stub-world.ts).
//
// Maps, Google search and AI answers are asked in two steps, because the cheap queue answers in minutes:
//   post     sends queries, each with a `tag` the caller uses to match results back; returns the provider's task ids
//            and what each cost. A query the provider answers at once (a live-only engine) carries its result.
//   collect  asks for the results of tasks posted earlier; each is ready, still pending, or failed. Free.
// Keyword data and finding a business are answered at once.

export type Coordinates = { lat: number; lng: number };

/** The provider's queue: standard is cheapest (minutes), priority is faster and dearer. */
export type Queue = "standard" | "priority";

// ---------- Google Maps ----------

export type MapsQuery = {
  keyword: string;
  /** The spot the search is made from. */
  at: Coordinates;
  /** Google Maps zoom for the search, 13 to 17. Closer spots need a closer zoom. */
  zoom: number;
  languageCode: string;
  /** How many businesses to read: 20 is the first screen of the map list. */
  depth: number;
};

/** One business in a Maps result. Rating, reviews and categories come free with every result. */
export type MapsItem = {
  position: number;
  placeId: string | null;
  cid: string | null;
  name: string;
  domain: string | null;
  category: string | null;
  categories: string[];
  rating: number | null;
  reviewCount: number | null;
  isClaimed: boolean | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
};
export type MapsResult = { items: MapsItem[] };

// ---------- Google search ----------

export type OrganicQuery = { keyword: string; at: Coordinates; languageCode: string; depth: number };

export type OrganicItem = { position: number; domain: string; url: string; title: string };
export type OrganicResult = {
  /** Normal results only, in order (ads, map pack and other blocks are not positions). */
  items: OrganicItem[];
  /** The page shows a map pack. */
  mapPack: boolean;
  /** The page shows an AI Overview, and the domains it cites. */
  aiOverview: { shown: boolean; citedDomains: string[] };
  /** "People also ask": real questions, good ideas for AI questions. */
  peopleAlsoAsk: string[];
};

// ---------- AI answers ----------

export const aiEngines = ["chatgpt", "google_ai", "perplexity"] as const;
export type AiEngine = (typeof aiEngines)[number];

export type AiQuery = {
  engine: AiEngine;
  question: string;
  /** Where the person asking is. Engines that take a place get it; the rest read the city from the question. */
  at: Coordinates;
  /** Two letters: engines that only take a country (ChatGPT) are asked from it. */
  countryCode: string;
  languageCode: string;
};
export type AiResult = {
  /** The answer as a person reads it (markdown stripped). Empty when the engine gave none. */
  text: string;
  citations: { domain: string; url: string }[];
};

// ---------- Site audit ----------

/** Crawl a website, following its own links from the home page, up to `maxPages`. */
export type AuditQuery = { domain: string; maxPages: number };

/**
 * What one crawled page says, as facts. The SEO module decides what is a problem (provider-neutral: no provider's
 * own check names). A null is "not measured", never "none".
 */
export type AuditPage = {
  url: string;
  statusCode: number;
  /** Clicks from the home page (0 is the home page). */
  depth: number | null;
  title: string | null;
  description: string | null;
  h1: string | null;
  wordCount: number | null;
  /** Some image on the page has no alt text. */
  imagesMissingAlt: boolean | null;
  /** How long the page took to load, in milliseconds. */
  loadMs: number | null;
  /** Links to this page from the site's other pages. */
  linksIn: number | null;
};

/** What the site says about itself as a whole, read from its home page and its files at the root. */
export type AuditSite = {
  homeUrl: string;
  /** Every JSON-LD and microdata type on the home page ("Dentist", "LocalBusiness", "FAQPage"). */
  schemaTypes: string[];
  /** Phone numbers written on the home page, as found. */
  phones: string[];
  /** robots.txt as served; null when there is none. */
  robotsTxt: string | null;
  /** Whether /llms.txt answers with a file. */
  llmsTxt: boolean;
};

/** A link from one of the site's pages to another of its own, with the words it's on (null: an image, or none). */
export type AuditLink = { from: string; to: string; anchor: string | null };

/** At most this many internal links are read from a crawl. */
export const AUDIT_LINKS = 5000;

export type AuditResult = { pagesCrawled: number; site: AuditSite; pages: AuditPage[]; links: AuditLink[] };

// ---------- The two-step protocol ----------

export type PostInput<Q> = {
  op: "post";
  queue: Queue;
  /** Called by the provider when a task is ready, with `{id}` in place of its task id. Null: we poll. */
  pingbackUrl: string | null;
  queries: { tag: string; query: Q }[];
};
export type Posted<R> = { tag: string; externalId: string; costMicros: number; result?: R };
export type PostOutput<R> = { posted: Posted<R>[] };

export type CollectInput<Q> = { op: "collect"; tasks: { externalId: string; query: Q }[] };
export type Collected<R> =
  | { externalId: string; status: "ready"; result: R }
  | { externalId: string; status: "pending" }
  | { externalId: string; status: "failed"; error: string };
export type CollectOutput<R> = { collected: Collected<R>[] };

export type SearchInput<Q> = PostInput<Q> | CollectInput<Q>;

// ---------- Keyword data ----------

export type KeywordMetric = {
  term: string;
  monthlySearches: number | null;
  cpc: number | null;
  /** 0 to 1: how many advertisers bid on it. */
  competition: number | null;
  /** The last 12 months, oldest first. */
  trend: number[];
};
export type KeywordIdea = {
  term: string;
  monthlySearches: number | null;
  /** The domain's position, when it ranks. */ position: number | null;
};

export type KeywordsInput =
  | { op: "volume"; terms: string[]; countryCode: string; languageCode: string }
  | { op: "ideas"; domain: string | null; seeds: string[]; countryCode: string; languageCode: string; limit: number };
export type KeywordsOutput = { metrics: KeywordMetric[] } | { ideas: KeywordIdea[] };

// ---------- Finding a business ----------

export type PlaceCandidate = {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** Two letters, ISO 3166. */
  countryCode: string | null;
  city: string | null;
  timezone: string | null;
  website: string | null;
  phone: string | null;
  category: string | null;
  rating: number | null;
  reviewCount: number | null;
};
export type PlacesInput = { query: string; near?: Coordinates | null };
export type PlacesOutput = { places: PlaceCandidate[] };

// ---------- A business's full Google profile ----------

/** What Google's business profile says about one business: the categories it lists and what customers talk about. */
export type BusinessDetails = {
  primaryCategory: string | null;
  /** Every category the profile lists, the primary one first. */
  categories: string[];
  description: string | null;
  /** What the profile says it offers (its attributes), as short names. */
  attributes: string[];
  /** What customers mention in reviews: services and qualities, most mentioned first. */
  topics: { term: string; mentions: number }[];
  /** Questions people ask about this kind of business. */
  questions: string[];
  /** Nearby places people also search for with this business: cities and neighbourhoods to track. */
  nearby: string[];
};
export type DetailsInput = {
  placeId: string;
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  languageCode: string;
  countryCode: string;
};
export type DetailsOutput = { details: BusinessDetails | null };
/** Google's whole list of business categories: the finite set a profile's category is chosen from. */
export type CategoriesInput = { op: "categories" };
/** Each with how many businesses Google lists under it, so the common ones can come first. */
export type CategoriesOutput = { categories: { name: string; businesses: number }[] };

/**
 * Every place Google can search from in one country (cities, towns, neighbourhoods, counties, states, postcodes):
 * what a person picks a city from. `name` is the provider's full path, comma-separated, the country last
 * ("Austin,Texas,United States"); `code` identifies the place, so two towns of one name can't be mistaken.
 */
export type LocationsInput = { op: "locations"; countryCode: string };
export type PlaceLocation = { code: number; name: string; type: string };
export type LocationsOutput = { locations: PlaceLocation[] };

/** A website's domain, without scheme, `www.` or path: what results are matched on. */
export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(/^https?:\/\//.test(url) ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

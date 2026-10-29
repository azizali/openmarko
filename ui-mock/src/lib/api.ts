// Service layer stubs. Every page reads mock data today; each function below
// documents the real endpoint it maps to so the backend can be filled in
// one call at a time. Keep credentials server-side: DataForSEO uses Basic
// auth and Google uses OAuth, so none of this should ever run in the browser.

import * as mock from "../data/mock";

const DFS = "https://api.dataforseo.com/v3";

export const endpoints = {
  // Rank tracking
  organicSerp: `${DFS}/serp/google/organic/live/advanced`, // location_coordinate per keyword
  mapsSerp: `${DFS}/serp/google/maps/live/advanced`, // one call per grid point: "lat,lng,zoom"
  localFinder: `${DFS}/serp/google/local_finder/live/advanced`,
  // Keyword research
  keywordIdeas: `${DFS}/dataforseo_labs/google/keyword_ideas/live`,
  keywordSuggestions: `${DFS}/dataforseo_labs/google/keyword_suggestions/live`,
  rankedKeywords: `${DFS}/dataforseo_labs/google/ranked_keywords/live`, // competitor gap
  domainIntersection: `${DFS}/dataforseo_labs/google/domain_intersection/live`,
  searchVolume: `${DFS}/keywords_data/google_ads/search_volume/live`,
  // Site audit
  onPageTask: `${DFS}/on_page/task_post`,
  onPageSummary: `${DFS}/on_page/summary`, // /{task_id}
  onPagePages: `${DFS}/on_page/pages`,
  lighthouse: `${DFS}/on_page/lighthouse/live/json`,
  // Competitors & citations
  businessInfo: `${DFS}/business_data/google/my_business_info/live`,
  businessReviews: `${DFS}/business_data/google/reviews/task_post`,
  businessListings: `${DFS}/business_data/business_listings/search/live`,
  backlinksSummary: `${DFS}/backlinks/summary/live`,
  // Google (OAuth)
  gscQuery: "https://searchconsole.googleapis.com/webmasters/v3/sites/{site}/searchAnalytics/query",
  ga4Report: "https://analyticsdata.googleapis.com/v1beta/properties/{property}:runReport",
  gbpLocation: "https://mybusinessbusinessinformation.googleapis.com/v1/locations/{location}", // PATCH with updateMask
  gbpReviewReply: "https://mybusiness.googleapis.com/v4/accounts/{account}/locations/{location}/reviews/{review}/reply",
  gbpLocalPosts: "https://mybusiness.googleapis.com/v4/accounts/{account}/locations/{location}/localPosts",
  gbpPerformance: "https://businessprofileperformance.googleapis.com/v1/locations/{location}:fetchMultiDailyMetricsTimeSeries",
} as const;

/** Grid of lat/lng points centred on the business, `radiusMi` from centre to edge. */
export function gridCoordinates(lat: number, lng: number, size: number, radiusMi: number) {
  const step = (radiusMi * 2) / (size - 1);
  const latPerMi = 1 / 69;
  const lngPerMi = 1 / (69 * Math.cos((lat * Math.PI) / 180));
  const c = (size - 1) / 2;
  const pts: { row: number; col: number; lat: number; lng: number }[] = [];
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++)
      pts.push({ row, col, lat: lat + (c - row) * step * latPerMi, lng: lng + (col - c) * step * lngPerMi });
  return pts;
}

/** Estimated DataForSEO cost for a grid scan (maps SERP, standard queue ≈ $0.0006/task). */
export function estimateGridCost(size: number, keywords: number, perTask = 0.0006) {
  return size * size * keywords * perTask;
}

const delay = <T,>(v: T, ms = 250) => new Promise<T>((r) => setTimeout(() => r(v), ms));

export const api = {
  getKeywords: () => delay(mock.keywords),
  getGridScan: (keywordId: string, size = 7) => delay(mock.makeGrid(keywordId, size)),
  getCompetitors: () => delay(mock.competitors),
  getAudit: () => delay({ summary: mock.auditSummary, issues: mock.auditIssues }),
  getKeywordIdeas: (_seed: string) => delay(mock.keywordIdeas),
  getActions: () => delay(mock.actions),
  executeAction: (id: string) => delay({ id, ok: true }, 900),
};

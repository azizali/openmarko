# Rankings & competitors: technical

## Code map

| File | Role |
|---|---|
| [pages/Rankings.tsx](../../../ui-mock/src/pages/Rankings.tsx) | `/rankings`, `/rankings/:id` |
| [components/KeywordTable.tsx](../../../ui-mock/src/components/KeywordTable.tsx) | Keyword + map pack table |
| [components/GridMap.tsx](../../../ui-mock/src/components/GridMap.tsx) | Geo-grid renderer (swap backdrop for MapLibre tiles) |
| [pages/Competitors.tsx](../../../ui-mock/src/pages/Competitors.tsx), [CompetitorDetail.tsx](../../../ui-mock/src/pages/CompetitorDetail.tsx) | Benchmark and head-to-head |
| [pages/Factors.tsx](../../../ui-mock/src/pages/Factors.tsx) | Ranking factors |
| [pages/Keywords.tsx](../../../ui-mock/src/pages/Keywords.tsx) | Keyword ideas |
| [data/mock.ts](../../../ui-mock/src/data/mock.ts) | `Keyword`, `GridPoint`, `GridScan`, `makeGrid`, `Competitor`, `FactorGroup`, `KeywordIdea` |
| [lib/api.ts](../../../ui-mock/src/lib/api.ts) | `gridCoordinates`, `estimateGridCost` |

## Data

```ts
type GridPoint = { row; col; rank: number | null; top3: string[] };
type FactorGroup = { id; name; weight; score; summary; factors: { name; status; detail; actionId? }[] };
type KeywordIdea = { term; volume; kd; cpc; intent; localPack; trend: number[]; competitorRanks? };
```

## Permissions (`rankings`)

view · edit (add keywords and competitors) · scan (run grid scans, edit tier).

## Real build

- Grid scans: `gridCoordinates()` → one DataForSEO `serp/google/maps` task per point (`location_coordinate: "lat,lng,15z"`), standard queue with postback. Cost ≈ $0.0006/task (`estimateGridCost`).
- Organic: `serp/google/organic/live/advanced`; local finder.
- Keyword ideas: `keyword_ideas`, `keyword_suggestions`, `ranked_keywords` (competitor gap), `domain_intersection`, `search_volume`.
- Competitors: `my_business_info`, reviews task, backlinks summary. Weekly refresh.
- Store scans and rankings in Postgres per Location; compute deltas server-side.

# Ad research: technical

## Code map

| File | Role |
|---|---|
| [pages/AdResearch.tsx](../../../ui-mock/src/pages/AdResearch.tsx) | Research and swipe tabs |
| [lib/creatives.ts](../../../ui-mock/src/lib/creatives.ts) | Ad swipe file (`SwipeAd`) in `gw-creatives` |
| [data/ads.ts](../../../ui-mock/src/data/ads.ts) | `LibraryAd`, angles |

## Permissions (`ad_research`)

view · edit (save ads). No per-control gating yet.

## Real build

Meta Ad Library (API covers EU/UK delivery only, so US ads need a scraper such as an Apify actor), Google Ads Transparency Center (SerpApi), TikTok Creative Center top ads, DataForSEO `ads_advertisers`. Days running and live version count signal a working ad. Foreplay import (`ads.library`).

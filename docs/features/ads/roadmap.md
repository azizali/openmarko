# Ads / Campaigns: roadmap

## Current state

Goal, guardrails, recommendations, review loop, performance table, change log with undo (`ceb4d59`).

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| Campaign data and verdicts | Mock rows in data/ads.ts. |
| Review now | Simulates days passing since the last review, including studio-made ads. |
| Apply / pause / budget edits | Local state in `gw-ads`. |
| Auto mode | Rules run in the browser on click. |
| Ad account connect | No OAuth. |

## To build

1. Ad platform OAuth and adapters (read insights, write status and budgets).
2. Conversion tracking (Pixel/CAPI, Google conversions, call tracking, booking sync).
3. Server-side review job, rules engine, Claude-written reasons.
4. Change log with real outcomes.
5. Per-control role gating on this page.

## Open questions

- Healthcare ad rules (Meta's restrictions on implying a condition) also apply to recommendations, not only creatives?
- Who pays for ad spend if the Partner manages it?

## Changelog

- `ceb4d59` "feat: ads".

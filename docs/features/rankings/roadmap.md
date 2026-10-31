# Rankings & competitors: roadmap

## Current state

All five pages complete with mock data, per-Location scoping, and the Map pack view merged into Rankings (`/grid` redirects).

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| Rankings, grids, history | Deterministic mock data (`makeGrid`). |
| Run scan | Animated run in memory. |
| Track keyword / add competitor | Toast or local state; not saved. |
| Generate more ideas | Next slice of mock ideas. |
| Map backdrop | Static; MapLibre tiles planned. |

## To build

1. Backend + DataForSEO client (server-side auth).
2. Grid scan queue with postbacks, runs and cost tracking.
3. Rankings tables per Location; delta computation.
4. Competitor discovery and weekly refresh.
5. Keyword research endpoints.
6. Ranking factor scoring model.

## Open questions

- Scan cost budgeting per plan (Billing shows "Grid scans this month 38/100").
- Factor weights: source and how they're tuned.

## Changelog

- `a89a285` initial UI; `ebc6813` per-Location scope.

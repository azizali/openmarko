# Prospecting: roadmap

## Current state

Search, bulk, saved list, table, audit, shared audit, view tracking (`a89a285`, `8a577fd`, `b53040a`, `52655b9`).

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| Search results | Generated deterministically from the search text (`data/prospects.ts`). |
| Contact quality, verified emails | Generated. |
| Missed revenue | Formula on generated data. |
| Saved searches | `localStorage`. |
| Share link | Token encodes the audit path; anyone with the link sees it; views recorded in this browser only. |
| Export / add to pipeline | Buttons; no file or CRM write. |

## To build

1. Prospect search pipeline on DataForSEO + enrichment.
2. Ease-of-sale scoring on real data.
3. Saved searches table.
4. Shares table, server-side view tracking, first-view notifications.
5. Audit PDF rendering (whitelabelled).
6. Pipeline: where prospects live once added (Partner-level CRM?).

## Open questions

- "Add to pipeline": the Organization's Contacts, or a Partner-level pipeline?
- Cost per search and how it's billed to the Partner.

## Changelog

- `a89a285` initial; `8a577fd` improved; `b53040a` shareable audit; `52655b9` cleaner with outreach.

# Social scanner: roadmap

## Current state

Three tabs, settings drawer, reply drafting, remix, watch list (`f8e6a62`, `f931901`).

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| Conversations, trends, standout posts | Made-up mock data. |
| Scanning and frequency | No scanner runs; settings are in memory. |
| Drafted replies and remixes | Templates. |
| Connect for login sources | Toggles a flag. |
| Mention alerts | Nothing sends. |

## To build

1. Per-source search adapters (respecting each platform's terms).
2. Scoring with Claude; reply drafting with the skill.
3. Trend ingestion and scoring.
4. Watched profile data and standout detection.
5. Persist config and reply status per Organization.

## Open questions

- Facebook groups and Nextdoor have no open search APIs: which sources are realistic at launch?

## Changelog

- `f8e6a62` trending and reply; `f931901` watching.

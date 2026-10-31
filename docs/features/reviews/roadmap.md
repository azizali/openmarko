# Reviews: roadmap

## Current state

Reviews tab with drafts, gated post button, Autopilot levels, assistant bulk reply (`a89a285`, `9454d87`).

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| Reviews | Mock data. |
| Drafted replies | Canned text. |
| Post reply | Marks the task done; Google not called. |
| Review request sends | Workflows mock (see [workflows](../workflows/)). |

## To build

1. GBP reviews sync and reply executor.
2. Draft generation with the skill and brand voice.
3. Low-rating alerts.

## Open questions

- Reviews from other sites (Yelp, Facebook)? Only Google today.

## Changelog

- `a89a285` initial; `9454d87` assistant replies; `2442e89` reply/post split in permissions.

# AI answers: roadmap

## Current state

Page complete with mock answers (`b53040a`).

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| Engine answers, scores, history | Mock data shaped like DataForSEO's AI Optimization API. |
| Add question | Local state. |
| AI answer check run | Animated run. |

## To build

1. AI Optimization API client; weekly job per Location.
2. Parse answers for business mentions and cited sources.
3. Link cited sites to Citations recommendations.

## Open questions

- How to make answers location-aware (engines don't take coordinates)?

## Changelog

- `b53040a` introduced.

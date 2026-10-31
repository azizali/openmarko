# Local SEO / Business Profile: roadmap

## Current state

Business Profile page with insights, completeness and the Reviews tab, scoped per Location (`a89a285`, scoped in `ebc6813`).

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| Insights and completeness | Mock data. |
| Applying a profile change | Task run state flips; Google isn't called. |
| Profile sync / "Updated X ago" | Seeded run. |

## To build

1. Google OAuth and the GBP provider adapter (per Location).
2. Profile sync job storing profile, insights and reviews per Location.
3. Profile edit executor with revert payload; respect Autopilot (`gbp_details` is high risk, default Ask first).

## Open questions

- Google may re-verify a profile after category changes: should the app block "On its own" for that permanently?

## Changelog

- `a89a285` initial UI; `ebc6813` per-Location scope.

# Feature switches: roadmap

## Current state

Complete in the mock (`b67365b`): catalog, switches, knock-on warnings, hidden pages and controls, "is off" page.

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| Features off for this Organization | `gw-features` in this browser, shared by every Organization in the switcher. |
| Background jobs stop | Nothing runs in the background in the mock. |

## To build

1. `organizations.features` JSON column; API reads it.
2. Job runner and webhooks skip turned-off features.
3. Plan limits: which features each plan includes, separate from the switch.

## Open questions

- Should turning a feature off be logged in Activity?
- Do plan-excluded features show as "upgrade" rather than hidden?

## Changelog

- `b67365b` "feat: feature enable/disable…": feature catalog and Settings → Features.

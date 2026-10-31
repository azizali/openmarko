# Home & reports: roadmap

## Current state

Home and Reports are complete visually with mock numbers (`a89a285`, `b53040a`, social added in `4f09fd3`).

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| All numbers and the Presence score | Mock data. |
| Scheduled reports | Nothing schedules or sends. |
| PDF | Print stylesheet. |
| "While you were away" | Static copy. |

## To build

1. Presence score formula and storage.
2. Report entity, scheduler, PDF renderer, email delivery (whitelabel sender).
3. Assistant-written summaries.

## Open questions

- Presence score weighting: documented nowhere yet.
- Should Viewers see report recipients?

## Changelog

- `b53040a` "feat: improved report, command center, shareable audit".
- `4f09fd3` "feat: updated dashboard with socials".

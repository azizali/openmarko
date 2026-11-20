# 0006. Feature switches, permissions and connections are separate checks

- Status: Accepted
- Date: 2026-10-31 (recorded)
- Affects: platform/feature-switches, platform/access-roles, platform/integrations, platform/app-shell

## Context

"Can I use this?" has three different answers that were easy to blur together.

## Decision

1. **Is it on?** `isOn(feature)`: the Organization's choice, plus its module and `needsAny`. Off hides pages and in-page controls; nothing is deleted.
2. **May I?** `can(resource, action)`: the Member's Role.
3. **Is it connected?** `lib/setup.ts` / Connections: pages show a Connect message (`<Needs>`) instead of their tools.

Nothing is required to start: each feature checks only what it reads.

## Consequences

- A page can be on and allowed but show Connect; or connected but hidden because it's off.
- The real build reads the features column in the API too, so a turned-off feature also stops its background jobs.

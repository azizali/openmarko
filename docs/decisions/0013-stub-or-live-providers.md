# 0013. Every provider adapter has a stub, chosen by config

- Status: Accepted
- Date: 2026-10-31
- Affects: platform/integrations, platform/backend, every module that calls a provider

## Context

DataForSEO, Google and Stripe cost money and need accounts. Development, tests and demos must run without them, and the owner wants to try each one for real when ready.

## Decision

- Each data provider (DataForSEO, Google and later others) has two adapters behind the same capability interface ([0002](0002-capabilities-not-providers.md)): `live` and `stub`. Stubs return realistic data shaped like the mock's seed data, and fake async work (postbacks, webhooks) on a timer.
- Config chooses: `PROVIDERS=stub` (default) or `PROVIDERS=live`, overridden per provider, e.g. `PROVIDERS=stub PROVIDERS_LIVE=dataforseo`.
- **Stripe is the exception**: always real, test mode in development. The `manual` billing provider covers running without payment ([0012](0012-billing-module-and-plans-as-data.md)).
- `GET /system/providers` shows which mode each provider is in.
- Stubs still write `usage_events`, so cost tracking can be tested.

## Consequences

- Tests and the demo deploy never hit a paid API.
- A stub that drifts from the real API's shape hides bugs. Each live adapter maps provider responses to the same types the stub returns, and both are tested against them.

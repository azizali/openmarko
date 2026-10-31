# 0002. Features depend on Capabilities, never on a Provider

- Status: Accepted
- Date: 2026-10-31 (recorded)
- Affects: platform/integrations and every feature that sends, publishes or reads outside data

## Context

Customers bring their own email provider, phone provider, sequencer and ad accounts, or use ours. Features shouldn't care which.

## Decision

Three layers in `data/integrations.ts`: a **Capability** (`email.send`, `reviews.reply`…) is a contract with ops and normalized events; a **Provider** is a catalog entry implementing some capabilities; a **Connection** is one connected instance attached to the Partner, Organization, Location or Website. Each capability says how many connections it takes (`one` or `many`, per what). Who may connect a provider follows the permissions of every capability it implements.

Backend: one interface per capability, one adapter per provider, `invoke(orgId, "email.send", input)` resolves the connection, and webhooks are normalized into capability events.

## Consequences

- Adding a provider is an adapter plus a catalog entry; no feature changes.
- A Social media manager can connect Instagram but not Twilio, without a special rule.
- In the mock, connection state still lives in each feature's store; `lib/integrations.ts` reads them into one shape. The real build collapses them into one `connections` table.

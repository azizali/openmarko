# Email: roadmap

## Current state

Setup flow for six providers (`83e1f32`), wired into Integrations (`105911e`).

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| Domain verification | Made-up records; check passes on a timer. |
| Delivery/open/click/bounce | Timers in lib/crm.ts. |
| Replies landing in Inbox | Simulated. |

## To build

1. Email adapters (start with one provider plus managed).
2. Domain verification via provider APIs.
3. Inbound reply routing per provider.
4. Suppression list (bounces, complaints, opt-outs).

## Changelog

- `83e1f32` introduced.

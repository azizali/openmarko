# Outreach: roadmap

## Current state

Connect flow, send to campaign, unibox, labels, settings (`88dddde`, `52655b9`).

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| Sequencer connection, inboxes, warmup | Sample data. |
| Leads sent | Local state. |
| Replies, labels, bounces | Timers add sample conversations. |
| Sending a reply | Appends to local thread. |

## To build

1. Sequencer adapters (PlusVibe first).
2. Webhook endpoint and lead threads.
3. Share link creation on send.
4. Assistant reply drafts.

## Open questions

- Capability says sequencers attach to the Partner; settings live under Organization. Pick one.

## Changelog

- `88dddde` introduced; `52655b9` cleaner prospecting integration; `105911e` Integrations wiring.

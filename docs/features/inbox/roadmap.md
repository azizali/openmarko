# Inbox: roadmap

## Current state

Unified threads, filters, call tasks, reply box (`83e1f32`).

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| Incoming messages | Timers simulate replies. |
| Sending replies | Appends to the local timeline. |
| Assistant drafts | Canned. |

## To build

1. Inbound webhooks → timeline.
2. Outbound sends via capabilities.
3. Assignment and labels.
4. Social comments and DMs.
5. Per-control role gating.

## Changelog

- `83e1f32` introduced.

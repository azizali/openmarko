# 0009. Modules announce events through an outbox table

- Status: Accepted
- Date: 2026-10-31
- Affects: platform/backend, every module that emits or handles events

## Context

When a module saves something and announces it (`review.received`), the save and the announcement are two steps. If the process dies between them, the event is lost, or announced for a save that never happened.

## Decision

An event is written as a row in `core.outbox` **in the same transaction** as the change it describes. A loop in the worker reads unprocessed rows in order, delivers each to the handlers registered for it, and marks it processed. Failed deliveries retry with backoff and record the error.

## Consequences

- No event is lost. An event can be delivered more than once after a crash, so **every handler must be idempotent** (for example, insert-if-absent keyed on the event id).
- Delivery is near-real-time (a poll every second or so), not instant.
- Moving to a real broker later means the outbox loop publishes to it; module code doesn't change.
- Processed rows are deleted after 7 days.

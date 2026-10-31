# Workflows: roadmap

## Current state

Builder, triggers, conditions, steps, exits, recipes, chaining (`83e1f32`, renamed from Automations in `b67365b`).

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| People enrolled and progressing | Timers in lib/crm.ts. |
| Stats | Seeded. |
| Date-based triggers | No scheduler. |

## To build

1. Event bus from contact changes and capability events.
2. Durable per-enrolment execution with waits.
3. Daily date & list check job.
4. Loop protection for chained workflows.

## Open questions

- Limits on chaining depth to avoid loops?

## Changelog

- `83e1f32` introduced as Automations; `b67365b` renamed to Workflows.

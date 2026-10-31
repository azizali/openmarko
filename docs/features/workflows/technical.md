# Workflows: technical

## Code map

| File | Role |
|---|---|
| [pages/Workflows.tsx](../../../ui-mock/src/pages/Workflows.tsx) | List and builder; `<Can>` on activate |
| [data/messaging.ts](../../../ui-mock/src/data/messaging.ts) | `When`, `Cond`, `Step`, `Wait`, `Exit`, `Workflow`, recipes, event groups |
| [lib/crm.ts](../../../ui-mock/src/lib/crm.ts) | Event emission (`Happened`), enrolment, step execution with timers |

```ts
type When = { event: EventId; tag?; stage?; list?; keyword?; date?: { field; days; dir }; workflow?; ended?; campaign? };
type Cond = { field: "tag" | "stage" | "source" | "location" | "can_text" | "can_email"; op: "is" | "is_not"; values };
type Step = { id; kind: "wait" | "sms" | "email" | "call" | "stage" | "tag" | "untag" | "start"; wait?; subject?; body?; stage?; tag?; workflow?; onlyIf?: "no_reply" | "not_booked"; stats? };
type Workflow = { id; name; on; when: When; only: Cond[]; steps: Step[]; exits: ("replied" | "booked" | "opted_out")[]; stats; recipe? };
```

Lists are saved filters, so "joins a list" covers any combination of tags, stage and dates.

## Permissions (`workflows`)

view · edit (build) · activate (turn on and off, publish).

## Real build

Every change to a contact written as an event that workflows subscribe to; workflows as durable jobs per enrolled contact; date/list triggers from the daily check; texts from the Location's number, email from the domain; BAA.

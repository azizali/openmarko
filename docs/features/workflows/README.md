---
id: workflows
kind: feature
module: customers
status: mock
depends_on: [customers]
capabilities: [email.send, sms.send, calls.route]
permissions: workflows
code:
  - ui-mock/src/pages/Workflows.tsx
  - ui-mock/src/data/messaging.ts
  - ui-mock/src/lib/crm.ts
related: [customers, email, sms, inbox, campaigns, reviews, automation]
last_verified: 105911e
---

# Workflows

Sequences that run per person when something happens. Pages: `/workflows`, `/workflows/:id` (were Automations; old links redirect). Not to be confused with Autopilot (the assistant acting for you) or Schedules (when jobs run): see [automation](../../platform/automation/).

**Status: `mock`.**

## What it can do

| Capability | State |
|---|---|
| **When**: contact added, tag added/removed, stage changed, joins/leaves a list, reply with a keyword, missed call, link clicked, opted out, appointment booked/visited/no-show/cancelled, a date (e.g. 180 days after last visit), another workflow ending, a campaign received/clicked/replied | `mock` |
| **Only if** conditions: tags, stage, source, location, can be texted/emailed | `mock` |
| **Steps**: text, email, call task (front desk gets a task with a script), wait, move stage, add/remove tag, start another workflow; each can run only if no reply / not booked | `mock` |
| **Stop** when they reply, book or opt out | `mock` |
| Chaining: sidebar shows what hands people in and out | `mock` |
| Recipes: Speed to lead, Missed call text-back, Reminders, Review request, 6-month recall, Recall second try, Reply YES to book, Clicked but didn't book, Birthday… | `mock` |
| Stats: in now, started and booked in 30 days, per-step done/replied/booked | **stub** |
| Daily date & list check (Schedules) | **stub** |

## How it connects

Uses Email and Texting for steps (skipped when off); creates call tasks in the Inbox. Off: nothing starts automatically; Workflow leaves the Contacts selection bar and the contact drawer.

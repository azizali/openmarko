---
id: automation
kind: platform
status: mock
depends_on: [feature-switches]
capabilities: []
permissions: [autopilot, activity]
code:
  - ui-mock/src/lib/tasks.ts
  - ui-mock/src/components/Todo.tsx
  - ui-mock/src/pages/Todo.tsx
  - ui-mock/src/lib/autopilot.ts
  - ui-mock/src/pages/Autopilot.tsx
  - ui-mock/src/lib/schedules.ts
  - ui-mock/src/lib/runs.ts
  - ui-mock/src/pages/Runs.tsx
  - ui-mock/src/components/RunStatus.tsx
related: [marko, ads, outreach, workflows, reviews, site-health, citations, content, social-posts]
last_verified: 105911e
---

# Automation: To-do, Autopilot, Schedules, Activity

Four pieces that keep the assistant's work and the app's background jobs in one place ([ADR 0005](../../decisions/0005-one-task-store.md)):

- **To-do**: the only action list. Every suggested change (improvements, site fixes, review replies, content) is a Task with Apply, Undo, Dismiss.
- **Autopilot**: per action, what the assistant may do without asking: **Off**, **Ask first** (becomes a To-do) or **On its own** (done, logged in Activity, with Undo).
- **Schedules**: everything that runs on its own clock (scans, syncs, reviews, the daily workflow check).
- **Activity**: the log of every run (status, progress, duration, trigger, cost, failures).

Workflows (your own contact rules) are separate: see [features/workflows](../../features/workflows/).

**Status: `mock`.**

## What it can do

| Capability | State |
|---|---|
| To-do: To do / Done / Dismissed, type chips, keyword filter, bulk apply, task drawer (impact, effort, how it's applied, editable change), apply, mark done, dismiss, revert; `?task=` deep link | `mock` |
| "This week" list on Home from the same tasks | `mock` |
| Applying a task anywhere shows it done everywhere | `mock` |
| Autopilot: 13 actions across Local SEO, Social, Ads, Contacts, Prospecting, each with risk and allowed levels; presets Careful / Low risk on its own / Hands-off | `mock` |
| Some actions capped at Ask first (1–3★ review replies) | `mock` |
| Ads mode/launch and Outreach review step are the same settings shown in both places | `mock` |
| Schedules: 11 jobs with frequency, next/last run, Run now | `mock` |
| Activity: run log with live progress | `mock` |
| Anything actually applied to Google, WordPress, directories, ad platforms | **stub** |
| Anything running on a clock | **stub**: no scheduler |

## Autopilot actions

| Action | Feature | Risk | Levels | Default |
|---|---|---|---|---|
| Publish Business Profile posts | seo | low | off/ask/auto | auto |
| Reply to 4–5★ reviews | reviews | medium | off/ask/auto | ask |
| Reply to 1–3★ reviews | reviews | high | off/ask | ask |
| Change Business Profile categories or description | seo | high | off/ask/auto | ask |
| Write image alt text | site_health | low | off/ask/auto | auto |
| Add or update structured data | site_health | medium | off/ask/auto | ask |
| Correct directory listings | citations | medium | off/ask/auto | ask |
| Publish articles | content | medium | off/ask/auto | ask |
| Fill empty calendar slots and publish | social_posts | medium | off/ask/auto | ask |
| Apply safe changes after each ads review | ads | medium | ask/auto | ask |
| Launch new ads from approved creatives | ad_studio | high | ask/auto | ask |
| Answer simple questions in the Inbox | inbox | medium | off/ask/auto | ask |
| Send prospects to the default campaign | outreach | medium | ask/auto | ask |

## Scheduled jobs

| Job | Feature | Options | Default |
|---|---|---|---|
| Business Profile sync | seo | hourly, 6h, daily | 6h |
| Rank scan | rankings | daily, 3d, weekly, paused | daily 06:00 |
| Competitor refresh | rankings | weekly, monthly, paused | weekly Sun |
| AI answer check | ai_answers | weekly, monthly, paused | weekly Mon |
| Citation check | citations | weekly, monthly, paused | weekly Wed |
| Backlink refresh | citations | weekly, monthly, paused | weekly Thu |
| Site crawl | site_health | daily, weekly, monthly, paused | weekly Mon |
| Social scanner | social_scanner | 6h, daily, weekly, paused | daily 07:00 |
| Competitor ad check | ad_research | daily, weekly, paused | daily 08:00 |
| Ads review (= Ads goal cadence) | ads | daily, 3d, weekly | daily 09:00 |
| Workflow date & list check | workflows | hourly, daily | daily 07:00 |

Report emails keep their own schedule in Reports.

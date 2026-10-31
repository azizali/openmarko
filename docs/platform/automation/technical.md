# Automation: technical

## Code map

| File | Role |
|---|---|
| [lib/tasks.ts](../../../ui-mock/src/lib/tasks.ts) | `Task` model built from mock actions, audit issues, reviews, content; run state store; `runTasks`, `dismissTask`, `undoTask`, `openTasksFor` |
| [components/Todo.tsx](../../../ui-mock/src/components/Todo.tsx) | To-do list, This week list, task drawer |
| [pages/Todo.tsx](../../../ui-mock/src/pages/Todo.tsx) | `/todo` |
| [lib/autopilot.ts](../../../ui-mock/src/lib/autopilot.ts) | `actions`, levels store `gw-autopilot`, `useAutopilot` (merges Ads and Outreach switches) |
| [pages/Autopilot.tsx](../../../ui-mock/src/pages/Autopilot.tsx) | Settings → Autopilot |
| [lib/schedules.ts](../../../ui-mock/src/lib/schedules.ts) | `jobs`, store `gw-schedules`, `useSchedules`, `setEvery` (ads_review writes the Ads goal) |
| [lib/runs.ts](../../../ui-mock/src/lib/runs.ts) | `Run` store, `startRun`, `runningOf`, `lastDone`, `runKinds` |
| [pages/Runs.tsx](../../../ui-mock/src/pages/Runs.tsx) | Settings → Activity |

## Data

```ts
type Task = { id; kind; title; why; impact: "High" | "Medium" | "Low"; keywordIds; cta; auto: boolean;
  preview?: { label; before?; after }; evidence?; steps; href?; via; effort };
type AutopilotAction = { id; feature: FeatureId; section; label; hint; risk: "low" | "medium" | "high"; levels: ("off" | "ask" | "auto")[]; start };
type Job = { id: JobId; feature; section; label; what; options: Every[]; start: Every; at?; run?: RunKind };
type Run = { id; kind: RunKind; label; trigger: "Scheduled" | "Manual"; status; started; expectedSec; durationSec?; progress; scope; cost; note? };
// RunKind: rank | audit | profile | competitors | ai | citations | links | prospect
```

## State today

- Tasks and runs: in memory (reset on reload).
- Autopilot: `gw-autopilot`; Ads values from `gw-ads`, Outreach from `gw-outreach`.
- Schedules: `gw-schedules`; `ads_review` from the Ads goal.

## Permissions

`autopilot.view` / `autopilot.edit` (manage tier) for Autopilot and Schedules; `activity.view` for Activity. Applying a task is not gated by role today (see [access-roles roadmap](../access-roles/roadmap.md)).

## Real build

- `organizations.autopilot` JSON; every assistant action checks its level before running and writes an activity row either way.
- One cron row per Organization and job; workers enqueue runs; a turned-off feature's jobs are skipped.
- `runs` table; progress from DataForSEO task postbacks; cost recorded per run.
- Executors (GBP Business Information API `PATCH locations/{id}?updateMask=…`, v4 reviews/localPosts, WordPress REST, citation partners, ad platform APIs) each log the change with a **revert payload** for Undo.

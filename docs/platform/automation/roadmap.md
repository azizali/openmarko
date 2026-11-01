# Automation: roadmap

## Current state

All four surfaces are complete in the mock. The task model unifies the old Action plan (`/actions/:id` redirects to `/todo?task=`).

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| Apply / Undo a task | Flips run state in memory; nothing changes on Google, the website or anywhere else. |
| Autopilot "On its own" | Stored level only; nothing acts on it. |
| Schedules and next run times | Stored frequency; no scheduler. |
| Run now / live progress | `startRun` animates progress on a timer. |
| Run cost | Made-up numbers. |

## To build

1. Job scheduler and worker queue per Organization.
2. Runs table and DataForSEO postbacks.
3. Executors with revert payloads (Google Business Profile, reviews, WordPress, citations, ads).
4. Autopilot check in front of every executor; activity log rows.
5. Persist tasks per Organization; regenerate from new data after each run.
6. Role checks on Apply (each task's feature action).

## Open questions

- Should "On its own" changes notify anyone, or only appear in Activity?
- Cost caps per Organization for scans (Billing shows sample limits).

## Changelog

- `8a577fd`: To-do and run log introduced.
- `b67365b` "feat: …automation, workflow, schedule settings": Autopilot (renamed from Settings → Automation) and Schedules.

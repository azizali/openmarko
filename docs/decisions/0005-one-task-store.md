# 0005. The assistant, To-do and Autopilot share one task model

- Status: Accepted
- Date: 2026-10-31 (recorded)
- Affects: platform/automation, features/marko, every feature that applies changes

## Context

The old Action plan, To-do and the assistant each proposed changes, and a fix applied in one place didn't show as done in the others.

## Decision

Improvements, site fixes, review replies and content are all **Tasks** in `lib/tasks.ts`. The assistant's task rows use the same Apply/Undo as To-do. **Autopilot** sets, per action, whether the assistant may act: Off, Ask first (creates a To-do) or On its own (applied and logged in Activity with Undo). Some actions never go above Ask first.

Three words stay apart: **Autopilot** (the assistant acting for you), **Schedules** (when things run), **Workflows** (your own contact rules).

## Consequences

- Every executor must return a revert payload so Undo works.
- The real build checks the Autopilot level before every assistant action and writes an activity row either way.

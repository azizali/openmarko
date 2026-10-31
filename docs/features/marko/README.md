---
id: marko
kind: module
status: mock
depends_on: []
capabilities: []
permissions: marko
code:
  - ui-mock/src/components/Assistant.tsx
  - ui-mock/src/lib/assistant.ts
  - ui-mock/src/components/Layout.tsx
related: [automation, brand-skills, whitelabel, social, reviews, rankings]
last_verified: 105911e
---

# Assistant

The chat assistant: ask questions and give instructions about anything in the app. Called "Marko" by default, "AI Assistant" (or the Partner's chosen name) under whitelabel. `FeatureId` is `marko`.

**Status: `mock`.** Answers come from intent matching against mock data, not a model.

## What it can do

| Capability | State |
|---|---|
| Open with ⌘J, **Ask** in the sidebar, or the floating button (draggable, remembers position) | `mock` |
| Panel docked beside any page; widens when an answer has a map | `mock` |
| Chat history (clock icon): every chat, newest first, with the page it started on and last answer; open or delete | `mock` (browser) |
| Knows the current page ("Looking at: Reviews", plus the open keyword on Rankings) and suggests questions for it | `mock` |
| Answers mix text with blocks: task rows with Apply/Undo (same as To-do), now-vs-30-days map, stat tiles, links | `mock` |
| "Do all", "Fix them", "Publish both", "Reply to all" apply tasks from the last answer; tasks needing a person are listed with steps | `mock` |
| Social: "What's trending this week?", "Make a TikTok in my voice", "Write an Instagram post about…", then "shorter" / "more playful" / "Schedule it" | `mock` |
| ⌘K: anything typed can be sent to the assistant | `mock` |
| Answers say which skill they used | `mock` |
| Real model, tools and streaming | `idea` |

## How it connects

Writes through [brand-skills](../../platform/brand-skills/); changes go through [automation](../../platform/automation/) tasks and obey Autopilot. Off: the chat panel, ⌘J, "Ask" in search and the reply box on Home are hidden.

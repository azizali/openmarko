---
id: ai_answers
kind: feature
module: seo
status: mock
depends_on: [seo]
capabilities: []
permissions: ai_answers
code:
  - ui-mock/src/pages/AiVisibility.tsx
  - ui-mock/src/data/ai.ts
related: [rankings, citations, sales, home-reports]
last_verified: 105911e
---

# AI answers

Whether ChatGPT, Google AI Overviews, Gemini, AI Mode, Perplexity and Claude name the business when people ask for a local recommendation. Page: `/ai`.

**Status: `mock`.**

## What it can do

| Capability | State |
|---|---|
| Score: share of tracked questions where each engine names you | `mock` |
| By-engine breakdown | `mock` |
| Who AI recommends instead (share of all answers naming each business) | `mock` |
| Sites AI answers cite, and whether you're listed there | `mock` |
| Each engine's answer per question, with history | `mock` |
| Add a question to track | `mock` |
| Row in Home's Presence score; "Do AI assistants recommend them?" section in every sales audit | `mock` |

## How it connects

- **Needs:** a Location.
- **Feeds:** Home, sales audits, Citations (AI-cited flag on directories).
- **Turned off:** `/ai` hides.

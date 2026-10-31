# AI answers: technical

## Code map

| File | Role |
|---|---|
| [pages/AiVisibility.tsx](../../../ui-mock/src/pages/AiVisibility.tsx) | `/ai` |
| [data/ai.ts](../../../ui-mock/src/data/ai.ts) | Engines, prompts, answers, cited sites |

## Data

```ts
type AiAnswer = { engine: EngineId; listed: string[]; position: number | null; sources: string[]; excerpt: string };
type AiPrompt = { id; text; keywordId; answers: AiAnswer[]; history: number[] };
```

Each question links to a tracked keyword.

## Permissions (`ai_answers`)

view · edit (track questions).

## Real build

DataForSEO AI Optimization API: `chat_gpt/llm_scraper`, `gemini/llm_scraper`, `perplexity/llm_responses`, `claude/llm_responses`, `llm_mentions/search_mentions`; AI Overviews come back as an `ai_overview` item in organic SERP results. Weekly check (Schedules). Store answers per Location per question per run.

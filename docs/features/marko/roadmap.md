# Assistant: roadmap

## Current state

Panel, history, page context, rich blocks, task application, social drafting (`9454d87`, social in `671583e`).

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| Understanding questions | `respond()` matches intents with keywords. |
| Answers and drafts | Built from mock data and templates. |
| Applying tasks | Same in-memory task store as To-do. |
| Chat history | This browser only. |

## To build

1. Backend route with Claude, tools mapped to executors, streaming blocks.
2. Skills as Agent Skills; brand voice as standing context.
3. Autopilot and role checks before every tool call.
4. Chat storage per Member per Organization.
5. Cost controls per plan.

## Open questions

- Should chats be private to the Member or shared with the team?

## Changelog

- `9454d87` "feat: AI assistant Ask Marko".

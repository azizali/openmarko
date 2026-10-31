# Assistant: technical

## Code map

| File | Role |
|---|---|
| [components/Assistant.tsx](../../../ui-mock/src/components/Assistant.tsx) | Panel, answer blocks, composer, floating button (`gw-marko-pos`) |
| [lib/assistant.ts](../../../ui-mock/src/lib/assistant.ts) | Conversation store (`gw-marko-chats`), page context, `respond()` intent matching |
| [components/Layout.tsx](../../../ui-mock/src/components/Layout.tsx) | ⌘J, gating on `isOn("marko")` and `can("marko", "use")` |

```ts
type Message = { id; role: "user" | "marko"; blocks: Block[]; followUps?: string[]; skills?: string[] };
type PageContext = { label; path; keywordId? };
type Chat = { id; title; page; updated; messages: Message[]; lastTaskIds: string[] };
```

A first visit seeds three example chats.

## Permissions (`marko`)

use (chat with the assistant, view tier). Whether its changes apply is decided by Autopilot and, in the real build, by the Member's role on the affected feature.

## Real build

A backend route sends the conversation and page context to Claude with tools mapped to the same executors (GBP API, WordPress, citation partners, ad platforms, social publishing) and streams the same blocks back. Brand voice is standing context; skills load as Agent Skills. Changes Autopilot hasn't allowed stay as task rows that wait for a click.

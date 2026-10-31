# Inbox: technical

## Code map

| File | Role |
|---|---|
| [pages/Inbox.tsx](../../../ui-mock/src/pages/Inbox.tsx) | `/inbox` |
| [lib/crm.ts](../../../ui-mock/src/lib/crm.ts) | `Conversation` = timeline channel events grouped by person; call tasks |

```ts
type Conversation = { contact: Contact; last: Event; unread: number; waiting: boolean; channels: Channel[] };
```

## Permissions (`inbox`)

view (read) · assign (assign and label, edit) · reply (publish). The Inbox page has no per-control `<Can>` gating yet.

## Real build

Inbound events from `email.received`, `sms.received`, `call.*`, `voicemail.received` (and later `comment.received`, `message.received`) appended to the contact timeline; assistant drafts with brand voice; Autopilot `inbox_simple` for auto-answers.

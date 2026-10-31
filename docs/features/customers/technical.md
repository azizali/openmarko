# Contacts (CRM): technical

## Code map

| File | Role |
|---|---|
| [pages/Contacts.tsx](../../../ui-mock/src/pages/Contacts.tsx) | `/contacts` |
| [components/Crm.tsx](../../../ui-mock/src/components/Crm.tsx) | Contact drawer, timeline, reply box |
| [lib/crm.ts](../../../ui-mock/src/lib/crm.ts) | One store (`gw-crm`) for contacts, timeline events, call tasks, campaigns, workflows, sending setup; message checks; workflow engine; timers stand in for replies and webhooks |
| [data/contacts.ts](../../../ui-mock/src/data/contacts.ts) | `Contact`, `Event`, `CallTask`, stages, sources, lists, merge fields, seed timelines |

```ts
type Contact = { id; name; email | null; phone | null; mobile; stage: Stage; source: Source; sourceDetail; location; tags: string[];
  value: number; consent: { email: boolean; sms: boolean; how: string }; createdAt; lastVisit | null; nextAppt | null; notes };
type Event = { id; contactId; at; kind: Channel | "note" | "stage" | "form" | "booking" | "visit"; dir?: "in" | "out"; subject?; body; by?; call?: { result; seconds }; read? };
type CallTask = { id; contactId; due; reason; script; from; done? };
```

Every change to a contact is also an event (tag added, stage changed, joined a list, replied…) that starts workflows listening for it.

## Permissions (`customers`)

view · edit (add, edit, import) · export (manage) · delete (manage).

## Real build

`contacts`, `events`, `call_tasks` tables per Organization. People come from the booking system (NexHealth / Open Dental sync), Meta lead forms and website forms (webhooks), call tracking (CallRail webhooks). BAA with every provider that touches patient data.

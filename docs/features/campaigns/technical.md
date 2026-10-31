# Campaigns: technical

## Code map

| File | Role |
|---|---|
| [pages/Campaigns.tsx](../../../ui-mock/src/pages/Campaigns.tsx) | List and editor; `<Can>` on send |
| [lib/crm.ts](../../../ui-mock/src/lib/crm.ts) | Campaign store, message checks (`Flag`), send simulation |
| [data/messaging.ts](../../../ui-mock/src/data/messaging.ts) | `Campaign`, `Audience`, `CampaignStats`, seed campaigns |

```ts
type Campaign = { id; name; channel; audience: { segment } | { ids; label }; subject; body;
  status: "draft" | "scheduled" | "sending" | "sent"; sendAt; sentAt; stats: CampaignStats | null; createdAt };
```

## Permissions (`campaigns`)

view · edit (draft) · send (publish).

## Real build

Audience resolved at send time with consent and suppression; batched sends via `email.send` / `sms.send`; stats from capability events; quiet hours; `campaign_received/clicked/replied` events for workflows.

# Outreach: technical

## Code map

| File | Role |
|---|---|
| [pages/Outreach.tsx](../../../ui-mock/src/pages/Outreach.tsx) | Replies, All leads |
| [components/Outreach.tsx](../../../ui-mock/src/components/Outreach.tsx) | Send-to-campaign flow, previews |
| [lib/outreach.ts](../../../ui-mock/src/lib/outreach.ts) | Store `gw-outreach`: connection, leads, threads, rules; timers stand in for webhooks |
| [data/sequencers.ts](../../../ui-mock/src/data/sequencers.ts) | Providers, inboxes, campaigns, steps |
| [pages/Settings.tsx](../../../ui-mock/src/pages/Settings.tsx) | Settings → Outreach |

```ts
type Connection = { provider; workspace; keyLast4; connectedAt; inboxes: Inbox[]; campaigns: Campaign[] };
type Rules = { defaultCampaign: string | null; review: boolean; verifiedOnly: boolean; alertOnAudit: boolean; bookingUrl: string };
type Inbox = { email; warmup; dailyLimit; sentToday; status: "ready" | "warming" | "paused" };
```

## Permissions (`outreach`)

view · send (send prospects to the sequencer, publish) · connect (manage).

## Real build

`sequencer_connections` row (API key encrypted), `outreach_leads` keyed by the sequencer's lead id, webhook endpoint appending to each lead's thread. PlusVibe: API key + workspace ID, `/lead/add`, `POST /api/v1/hook/add` for `ALL_EMAIL_REPLIES`, `LEAD_MARKED_AS_<LABEL>`, `UNIBOX_EMAIL_SENT`; replies via Unibox "Reply to an email". Labels map to Interested / Meeting booked / Not interested. Check each provider's API reference before building: the mock calls nothing.

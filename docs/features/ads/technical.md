# Ads / Campaigns: technical

## Code map

| File | Role |
|---|---|
| [pages/Ads.tsx](../../../ui-mock/src/pages/Ads.tsx) | `/ads` |
| [components/Ads.tsx](../../../ui-mock/src/components/Ads.tsx) | Goal card, recommendation rows, performance table pieces |
| [lib/ads.ts](../../../ui-mock/src/lib/ads.ts) | Store `gw-ads`: connections, `Goal`, recommendation rules, review loop, `Change` log, undo, publishing (`PublishSpec`) |
| [data/ads.ts](../../../ui-mock/src/data/ads.ts) | Platforms, tools, campaign `Row`s, other advertisers' ads, angles, copy bank |

```ts
type Rec = { id; kind: RecKind; rowId; title; why; impact; safe: boolean };
type Change = { id; at; by: "you" | "marko"; kind; title; rowId?; before?: Partial<Row>; outcome?; undone? };
type Metrics = { spend; results; impressions; clicks; cpa; ctr; budget };
```

## Permissions (`ads`)

view · edit (draft campaigns and targeting) · publish (launch, pause, change budgets) · connect (connect ad accounts and set the goal, manage tier). The Ads page has **no per-control `<Can>` gating** yet.

## Integrations

Meta Ads, Google Ads, TikTok Ads (`ads.read`, `ads.publish`); Meta Pixel + CAPI, Google Ads conversions (`ads.conversions`); CallRail (`calls.track`); NexHealth (`bookings.read`); GA4 (`analytics.read`).

## Real build

- Scheduled job per Organization pulls insights from each ad account, runs the same rules, asks Claude to write the reasons, writes changes back through the Meta / Google / TikTok APIs.
- Results: Pixel + Conversions API and Google enhanced conversions, call tracking, booking system, so a result is a booked patient.
- Every change logged with `before` for Undo; Autopilot `ads_safe` decides apply vs To-do.

# Citations & backlinks: technical

## Code map

| File | Role |
|---|---|
| [pages/Citations.tsx](../../../ui-mock/src/pages/Citations.tsx) | Both tabs; `<Can>` on submit |
| [data/authority.ts](../../../ui-mock/src/data/authority.ts) | `Citation`, `LinkOpportunity`, `Backlink` |
| [data/scoped.ts](../../../ui-mock/src/data/scoped.ts) | Per-Location citations |

```ts
type Backlink = { domain; anchor; authority; firstSeen; follow: boolean; state: "new" | "lost" | "live"; local: boolean };
```

## Permissions (`citations`)

view · submit (submit and fix listings, publish tier).

## Real build

- Tracking: one Google search per directory for name + phone (DataForSEO SERP, `site:` query), parse the listing (On-Page `content_parsing`), compare name, address, phone, hours, URL.
- Building: aggregator + manual submissions through a partner (BrightLocal or Whitespark); Google, Apple and Bing via their APIs.
- Backlinks: DataForSEO Backlinks API (`summary`, `referring_domains`, `backlinks` with new/lost, `domain_intersection` for the gap).
- Weekly citation check and backlink refresh (Schedules).

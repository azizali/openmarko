# Social scanner: technical

## Code map

| File | Role |
|---|---|
| [pages/SocialScanner.tsx](../../../ui-mock/src/pages/SocialScanner.tsx) | All three tabs and the settings drawer |
| [data/scanner.ts](../../../ui-mock/src/data/scanner.ts) | `Platform` (`login`, `places`), listening terms, `Opportunity` |
| [lib/scanner.ts](../../../ui-mock/src/lib/scanner.ts) | In-memory: `Config`, `ScanSource`, reply status, edited drafts, scan time |
| [data/watch.ts](../../../ui-mock/src/data/watch.ts), [lib/watch.ts](../../../ui-mock/src/lib/watch.ts) | `WatchedProfile`, `StandoutPost`; watch list shared with onboarding |
| [data/social.ts](../../../ui-mock/src/data/social.ts) | `Trend`, `Remix` |

```ts
type ScanSource = { platform: PlatformId; enabled: boolean; connected: boolean; places: string[] };
type WatchedProfile = { id; platform; handle; name; kind: "competitor" | "inspiration"; followers };
```

## Permissions (`social_scanner`)

view (trends and watched profiles) · edit (watch and unwatch profiles).

## Real build

- Conversations: scheduled job per Organization searching listening terms; Reddit search API, X recent search API, Quora and Nextdoor via web search, Facebook groups the business has joined via Graph API where allowed. Claude scores intent and fit; `community-reply` drafts.
- Trends: TikTok Creative Center, Instagram Reels trends, Google Trends for the metro, Reddit, local news RSS; scored for velocity and fit; Claude writes "why it works" and the remix.
- Watched profiles: Meta business discovery, TikTok/YouTube public data, X timelines. A post "stands out" at ≥2× the profile's median views or engagement.

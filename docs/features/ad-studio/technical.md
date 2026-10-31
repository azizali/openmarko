# Creative studio: technical

## Code map

| File | Role |
|---|---|
| [pages/AdStudio.tsx](../../../ui-mock/src/pages/AdStudio.tsx) | `/ads/studio`; `<Can>` on make/publish |
| [lib/creatives.ts](../../../ui-mock/src/lib/creatives.ts) | `Brief`, `Creative`, `Flag`, `Batch`, checks and scores; `gw-creatives` |
| [lib/ads.ts](../../../ui-mock/src/lib/ads.ts) | `PublishAd`, `PublishSpec`, publish into campaigns |

```ts
type Brief = { name; offer; landing; angles; hooks: number; formats; sizes; styles; refs: string[] };
type Flag = { level: "block" | "warn"; text };
```

## Permissions (`ad_studio`)

view · edit (make creatives) · publish (publish creatives).

## Real build

Claude writes each variation from the brief, references and brand voice (Ad creative skill); renderer (Creatomate or Bannerbear) draws every size from one template with generated or uploaded photos; Canva for brand kit and fine-tuning; publish via `ads.publish`.

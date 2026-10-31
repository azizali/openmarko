# Marketing site: technical

## Code map

| File | Role |
|---|---|
| [site/src/App.tsx](../../../site/src/App.tsx) | Routes |
| [site/src/data/site.ts](../../../site/src/data/site.ts) | `SAMPLE_CONTENT`, `APP_URL`, `Plan` and plans, offer |
| [site/src/data/services.ts](../../../site/src/data/services.ts) | Service pages |
| [site/src/data/competitors.ts](../../../site/src/data/competitors.ts) | Comparison data (sourced from research) |
| [site/src/data/stories.ts](../../../site/src/data/stories.ts) | Sample case studies |
| [site/src/components/](../../../site/src/components/) | Layout, sections, visuals |

Stack: Vite, React, Tailwind (same as ui-mock). `pnpm dev` / `pnpm build`.

## Real build

Host as static files; analytics; sign-up links into the app's auth; real stories; legal pages (privacy, terms, BAA info for healthcare customers).

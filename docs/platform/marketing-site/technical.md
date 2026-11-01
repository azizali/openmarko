# Marketing site: technical

## Code map

| File | Role |
|---|---|
| [site/src/App.tsx](../../../site/src/App.tsx) | Routes |
| [site/src/data/site.ts](../../../site/src/data/site.ts) | `SAMPLE_CONTENT`, `APP_URL`, `Plan` and plans, offer |
| [site/src/data/services.ts](../../../site/src/data/services.ts) | Service pages |
| [site/src/data/competitors.ts](../../../site/src/data/competitors.ts) | Comparison data (sourced from research) |
| [site/src/data/stories.ts](../../../site/src/data/stories.ts) | Sample case studies (with fictional map-pack `rivals`), testimonials and `videoTestimonials`. Video cards open a transcript; there are no video files yet |
| [site/src/data/antiAgency.ts](../../../site/src/data/antiAgency.ts) | Homepage copy: agency pains, the seven jobs Marko does across Maps, Google search and AI (with demo scoreboard numbers), agency-vs-Marko rows, FAQ. Lines marked PROPOSED are unconfirmed claims |
| [site/src/components/marko.tsx](../../../site/src/components/marko.tsx) | Homepage visuals: `SerpMock` (AI Overview, map pack, organic results) and its mobile `PresenceStrip`; competitor, site audit, service-area, backlinks and citations panels; `PackBeforeAfter` and `VideoCard` for proof; agency report, Autopilot panel, agency-vs-Marko table, `Strike`, scroll-step hooks |
| [site/src/data/persona.ts](../../../site/src/data/persona.ts) | Who the homepage is about: eight `trades` plus Other (search words, example business, services, rivals, review, AI question, supplier), `resolvePersona()` (blank fields fall back to the sample, Carter Plumbing & Drain in Austin) and `fill()` for `{placeholders}` in homepage copy |
| [site/src/components/persona.tsx](../../../site/src/components/persona.tsx) | `PersonaProvider` / `usePersona()`, `Mine` (the drawn-in underline on the visitor's words), `TradePicker` dialog, `FollowAlong` label, `BannerCapture`, `PersonaChip` and `PreviewNote` |
| [site/src/data/geo.ts](../../../site/src/data/geo.ts) | `cityFromIp()`: the visitor's city from ipapi.co, with a timeout and session cache; never throws |
| [site/src/components/](../../../site/src/components/) | Layout, sections, visuals |

Stack: Vite, React, Tailwind (same as ui-mock). `pnpm dev` / `pnpm build`.

## Personalised homepage

The homepage tells one business's story: by default "one plumber in Austin", labelled "Follow along" above the hero search mock so visitors in other trades read it as an example. It adapts in three steps, none of them required:

1. **Trade.** A "What kind of business do you run?" dialog (`TradePicker`, a native `<dialog>`) opens once per browser on first visit, with eight trades and Other. Skipping keeps the plumber. "Not a plumber?" beside the Follow along label reopens it. Other uses neutral wording ("one local business").
2. **City.** Guessed from the visitor's IP on first load (`data/geo.ts`). If the lookup fails or is blocked, the city stays Austin.
3. **Name.** Only if they type it in the banner under the hero (`BannerCapture`), which also lets them correct the city and trade. Until then the page follows the trade's example business (`Trade.example`, such as Maple & Main Dental).

Once trade or city differ from the default, the search mock, every story panel, the agency-pains line and the FAQ follow along. Once they name their business, the hero copy and final CTA use the name, a "Previewing as" chip rides along at the bottom, and `PreviewNote` says the view is a preview of the goal, not their live ranking. The audit form picks up the name.

- State lives in `PersonaProvider` on the home page only, committed 350 ms after typing stops and kept in `localStorage` (`om-persona`; `om-trade-asked` remembers the dialog was seen). Outside the provider every component reads the sample, so service and comparison pages are unchanged.
- **IP lookup is a real third-party call:** the browser asks ipapi.co (free, no key, about 1,000 lookups a day), which sends the visitor's IP to that service. The privacy policy must say so. Replace it with the host's edge geo header once hosting is chosen. Cached per session in `sessionStorage`.
- Rankings, ratings and review counts stay the sample's; nothing the visitor enters is sent anywhere.

## Real build

Host as static files; analytics; sign-up links into the app's auth; real stories; legal pages (privacy, terms, BAA info for healthcare customers).

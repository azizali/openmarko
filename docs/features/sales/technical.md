# Prospecting: technical

## Code map

| File | Role |
|---|---|
| [pages/Prospects.tsx](../../../ui-mock/src/pages/Prospects.tsx) | Search, results, saved list, bulk |
| [pages/ProspectAudit.tsx](../../../ui-mock/src/pages/ProspectAudit.tsx) | Sales audit |
| [pages/PublicAudit.tsx](../../../ui-mock/src/pages/PublicAudit.tsx) | `/a/:token`, no app chrome |
| [data/prospects.ts](../../../ui-mock/src/data/prospects.ts) | Seeded generator: niches, `Prospect`, `Company`, `Contact`, `SiteCheck`, `QuickWin`, `Market`, `Spec`, ease-of-sale scoring, prospect grid, `prospectSources` |
| [lib/saved.ts](../../../ui-mock/src/lib/saved.ts) | Saved searches/audits (`gw-saved-prospects`) |
| [lib/shares.ts](../../../ui-mock/src/lib/shares.ts) | Share links and views (`gw-audit-shares`) |
| components: ProspectMap, ProspectContact, NewAudit, ShareAudit | Pieces |

## Permissions (`sales`)

view · edit (find and audit) · share (share audit links, publish) · export (manage).

## Real build

`prospectSources` in data/prospects.ts maps every field to an API. Highlights: DataForSEO Business Listings search (with `["url", "=", null]` for no-website), Maps SERP for grid, `content_parsing` for emails/phones/socials, `domain_technologies`, `whois`, `domain_rank_overview`, `ads_advertisers`, Twilio Lookup for line type. `saved_searches` table holding spec + raw results so reopening reads the DB, not the API. `shares` table with a short random token, server-side view logging, email/Slack ping on first view.

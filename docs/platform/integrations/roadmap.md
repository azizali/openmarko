# Integrations: roadmap

## Current state

The three-layer model and full catalog exist in `data/integrations.ts` and are wired into Settings → Integrations, feature-page drawers and permission checks (added in `105911e`). Every connection is simulated.

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| Sign in with Google / Meta / TikTok etc. | No OAuth. The connection appears with a sample account name. |
| API key fields | Not validated or stored securely; `localStorage` at most (last 4 chars for sequencers). |
| DNS records for email | Shaped like the real ones but made up. "Check now" passes on a timer. "Add them for me" (Cloudflare) does nothing real. |
| Phone numbers, porting, 10DLC | Sample numbers; registration is prefilled text. |
| Sequencer inboxes, warmup, campaigns | Sample data from data/sequencers.ts. |
| Delivery, reply and bounce webhooks | Timers in lib/crm.ts and lib/outreach.ts. |
| Connection status `action` / `pending` | Set by the mock stores, not by provider health checks. |
| Provider `extras` | Shown only; not wired to features. |

## To build

1. `connections` table and credential vault.
2. Capability interfaces + adapters, starting with what unblocks the most: Google Business Profile (reviews, profile, posts, insights), email.send/receive (one provider first), sms.send.
3. OAuth apps per platform (Google, Meta, TikTok, LinkedIn, X) with token refresh.
4. Webhook ingestion endpoint per provider, normalized into capability events.
5. Real DNS verification for sending domains; neutral DNS zone for whitelabel ([whitelabel](../whitelabel/)).
6. Health checks that set connection status and notify.
7. BAA review per provider before patient data flows.

## Open questions

- Which email and phone provider to run as "managed" (ours)?
- Ad library data for US Meta ads needs a scraper (Apify) since the API covers EU/UK only; acceptable?
- Do we store sequencer API keys per Partner or per Organization? (Capability says Partner; Settings → Outreach sits under Organization settings.)

## Changelog

- `105911e` "feat: better integration": capability/provider/connection model, Settings → Integrations page, unified drawers.
- `83e1f32` "feat: CRM, email": email and texting setup flows, providers.
- `88dddde` "feat: outreach": sequencer connection.
- `ceb4d59` "feat: ads": ad account and ad tool connections.

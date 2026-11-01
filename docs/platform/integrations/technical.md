# Integrations: technical

## Code map

| File | Role |
|---|---|
| [data/integrations.ts](../../../ui-mock/src/data/integrations.ts) | Capability and Provider catalog, `permissionsFor`, `providersFor`. No React imports; server-importable. |
| [lib/integrations.ts](../../../ui-mock/src/lib/integrations.ts) | `useConnections()` reads every store into one `Connection[]`; `servingOf`, `replaces`, `openTargets`, `canConnect`, connect/disconnect routing, open-drawer store. |
| [pages/Integrations.tsx](../../../ui-mock/src/pages/Integrations.tsx) | Settings → Integrations (`?cat=`, `?cap=`). |
| [components/Integrations.tsx](../../../ui-mock/src/components/Integrations.tsx) | Provider drawer and connect flows, used from any page. |
| [components/Sending.tsx](../../../ui-mock/src/components/Sending.tsx) | Email and texting setup flows. |
| [data/providers.ts](../../../ui-mock/src/data/providers.ts) | Email and phone provider fields, DNS records, privacy (BAA) notes. |
| [data/sequencers.ts](../../../ui-mock/src/data/sequencers.ts) | Sequencer inboxes, campaigns, steps. |

## Three layers

```ts
type Capability = {
  id: CapabilityId; label; does;
  per: "partner" | "organization" | "location" | "website";
  max: "one" | "many";                 // "one": a second connection replaces the first, per `per`
  permission: [Resource, action];      // needed to connect or disconnect
  usedBy: FeatureId[];
  ops: string[];                       // adapter interface
  events: string[];                    // normalized webhook events
};
type Provider = { id; name; vendor?; category; auth: "managed" | "oauth" | "api_key"; attach; capabilities: CapabilityId[]; extras?; requires?; fields?; metered: { meter: string; unit: string } | null };
// metered: null for free integrations (Google Search Console, GA4, Google sign-in). Paid per-use providers name their meter, e.g. { meter: "dataforseo.maps", unit: "request" }. See ADR 0012.
type Connection = { id; provider; target: { kind: Attach; id; label }; account; status: "ok" | "action" | "pending"; note?; since? };
```

### Capabilities

| Capability | Per | Max | Permission | Used by | Events |
|---|---|---|---|---|---|
| email.send | org | one | email.connect | campaigns, workflows, inbox | delivered, bounced, complained, opened, clicked |
| email.receive | org | one | email.connect | inbox | received |
| sms.send | org | one | sms.connect | campaigns, workflows, inbox | delivered, failed, received, opted_out |
| calls.route | org | one | sms.connect | inbox, workflows | call.completed, call.missed, voicemail.received |
| leads.push / leads.replies / leads.labels | partner | one | outreach.connect | outreach | lead.sent / replied, bounced / labeled |
| ads.read | org | many | ads.connect | ads | |
| ads.publish | org | many | ads.connect | ads, ad_studio | ad.rejected, ad.approved |
| ads.conversions | org | many | ads.connect | ads | |
| calls.track | org | one | ads.connect | ads | call.tracked |
| bookings.read | org | one | ads.connect | ads, customers | booking.created, booking.cancelled |
| creatives.render / creatives.design | org | one | ads.connect | ad_studio | render.done |
| ads.library | org | many | ads.connect | ad_research | |
| social.publish | org | many | social.connect | social_posts | post.published, post.failed |
| social.insights | org | many | social.connect | social, social_posts | |
| social.inbox | org | many | social.connect | inbox | comment.received, message.received |
| reviews.read / reviews.reply | location | one | seo.connect | reviews | review.received |
| profile.edit / profile.posts / profile.insights | location | one | seo.connect | seo, social_posts | |
| search.read | website | one | setup.connect | rankings, content, site_health | |
| analytics.read | website | one | setup.connect | content, ads | |
| site.write | website | one | setup.connect | site_health, content | |
| notify.send | org | many | organization.update | (alerts, digests) | |

### Providers (32)

Email: managed, Amazon SES, Resend, Mailgun, Postmark, SendGrid. Texting & calls: managed, Twilio, Telnyx. Cold outreach (attach to Partner): PlusVibe, Instantly, Smartlead. Ads: Meta Ads, Google Ads, TikTok Ads. Ad tracking: Meta Pixel + CAPI, Google Ads conversions, CallRail, NexHealth (booking). Creative: Creatomate, Canva, Foreplay. Social: Instagram, Facebook, TikTok, X, LinkedIn. Google: Business Profile (per Location). Website: Search Console, GA4, WordPress. Notifications: Slack.

## State today

`lib/integrations.ts` doesn't own most connection state. It reads from the stores that already hold it and routes connect/disconnect back:

| Connection kind | Source store |
|---|---|
| Email, texting | `gw-crm` (lib/crm.ts) |
| Ad accounts, ad tools | `gw-ads` (lib/ads.ts) |
| Sequencer | `gw-outreach` (lib/outreach.ts) |
| Google Business Profiles, social Accounts | lib/setup.ts (in memory) |
| Website tools, Slack, extra social accounts | `gw-integrations` (own store) |

## Real build

- One `connections` table: `{ id, provider, attach, targetId, account, credentialsRef, status, createdAt }`; credentials in a vault; the rest of each store's state stays on its feature.
- One interface per capability (its `ops`), one adapter per provider. `invoke(orgId, "email.send", input)` resolves the connection.
- Webhooks normalized into capability `events`; features subscribe to `email.bounced` without knowing the provider.
- Provider notes from data/providers.ts and data/sequencers.ts: SES (IAM key, Easy DKIM, SNS, receipt rules), Resend (/domains, webhooks, receiving), Mailgun (region, Routes), Postmark (inbound stream), SendGrid (Event Webhook, Inbound Parse), Twilio/Telnyx (number search/buy, hosted SMS, port-in, A2P 10DLC), PlusVibe (`/lead/add`, `POST /api/v1/hook/add`).
- **BAA**: patient data (dental/health customers) may only go through providers that sign one.

## Websites: the CMS contract (built)

Websites connect through a CMS contract, not a CMS ([ADR 0016](../../decisions/0016-websites-connect-through-a-cms-contract.md)). Code: `modules/integrations/src/site/`.

| CMS | Provider id | Live | Notes |
|---|---|---|---|
| WordPress | `wordpress` | publish, read page, title, meta description | Meta description only with `seoPlugin` = `yoast` or `rankmath` |
| Webflow | `webflow` | stub only | |
| Shopify | `shopify` | stub only | |
| Ghost | `ghost` | stub only | |
| Custom site | `custom_site` | all four | Signed POST to the customer's endpoint (`x-openmarko-signature: t=<unix>,v1=<hmac>`) |

Connecting: `POST /api/v1/organizations/:orgId/connections` with `values` for the provider's catalog fields. Secret fields are encrypted; the rest become the Connection's `settings` and are returned by the list.

## DataForSEO: several APIs, one client (built)

Code: `modules/integrations/src/adapters/dataforseo/`. `client.ts` is the only place that talks HTTP; `apis.ts` has one section per DataForSEO API; `index.ts` maps capabilities to them.

| Capability | DataForSEO API | Endpoint | Live |
|---|---|---|---|
| `serp.read` (organic) | SERP | `serp/google/organic/live/advanced` | written |
| `serp.read` (maps) | SERP | `serp/google/maps/live/advanced` | written |
| `keywords.research` | DataForSEO Labs | `dataforseo_labs/google/keyword_ideas/live` | written |
| `backlinks.read` | Backlinks | `backlinks/referring_domains/live` | written |
| `ai.visibility` | AI Optimization | `ai_optimization/{chat_gpt,gemini}/llm_scraper/live/advanced` | written |
| `site.crawl` | On-Page | `on_page/task_post` + postback | not built: crawls are asynchronous and need the postback job (501 live) |

- **Auth:** HTTP Basic with the **API login and API password** from the DataForSEO dashboard (not the account sign-in). Both are secret fields, encrypted per Connection.
- **Errors:** the envelope status and each task's status are both checked (`20000` = OK). A task error inside an OK response is an error.
- **Cost:** live calls meter the `cost` DataForSEO returns, converted to micros. Stubs use rough published prices.
- **Shapes:** every API maps its response to the capability's output type (`modules/integrations/src/seo-data.ts`). Stubs return the same types, so live data matches what features read.
- **REST, not the SDK:** every DataForSEO API is the same request and envelope, so one ~60-line client covers them. The official `dataforseo-client` SDK is about 42 MB of generated code. Swapping it in later only changes `client.ts`.
- **Adding an API:** a function in `apis.ts` that returns a type from `seo-data.ts`, and a capability case in `index.ts`.

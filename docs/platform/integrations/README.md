---
id: integrations
kind: platform
status: mock
depends_on: [organizations-partners, access-roles]
capabilities: all
permissions: per capability (see technical.md)
code:
  - ui-mock/src/data/integrations.ts
  - ui-mock/src/lib/integrations.ts
  - ui-mock/src/pages/Integrations.tsx
  - ui-mock/src/components/Integrations.tsx
  - ui-mock/src/data/providers.ts
  - ui-mock/src/components/Sending.tsx
related: [email, sms, outreach, ads, social-posts, seo, site-health, content]
last_verified: 105911e
---

# Integrations

Every outside service connected to the Partner, an Organization, a Location or a Website, managed in one place: **Settings → Integrations**. Connect something once and every feature that can use it does. Feature pages show the same connections inline and open the same drawer.

**Status: `mock`.** The catalog (27 capabilities, 32 providers) and the connection model are designed. Nothing connects to a real service: OAuth, API keys, DNS checks and webhooks are all simulated.

## Who uses it

Owners and Admins set up sending, ad accounts and Google; a Social media manager can connect social Accounts but not Twilio (permissions follow capabilities). Partner Admins connect the cold-email sequencer for the agency.

## What it can do

| Capability | State |
|---|---|
| One catalog page with categories (Email, Texting & calls, Cold outreach, Ads, Ad tracking, Creative, Social, Google, Website, Notifications), search, and filter by capability | `mock` |
| Each provider shows what it powers, which features use it, and extras beyond the capability | `mock` |
| Connect a provider to the right target (Partner / Organization / Location / Website) | **stub**: no OAuth or key validation |
| "One" capabilities replace the existing connection (one email sender per Organization) | `mock` |
| Connect gated by the permissions of every capability the provider implements | `mock` |
| Email setup flow: pick provider → keys → sending domain → DNS records with copy, "Add them for me" for Cloudflare, Check now | **stub**: records are made up; check always passes after a delay |
| Texting setup: new local number per Location, text-enable an existing number, or port; A2P 10DLC registration prefilled | **stub** |
| Sequencer connect: API key (+ workspace for PlusVibe), inboxes and warmup, webhooks, default campaign | **stub**: sample inboxes and campaigns |
| Ad accounts, ad tracking, creative tools | **stub** |
| Managed providers carry the product name (whitelabel) | `mock` |

## How it connects

- Features declare which **capabilities** they need, never a provider ([ADR 0002](../../decisions/0002-capabilities-not-providers.md)).
- `lib/setup.ts` tracks the Location/Website/Account connections that decide whether a page shows its tools or a **Connect** message ([app-shell](../app-shell/)).
- Permissions come from [access-roles](../access-roles/).

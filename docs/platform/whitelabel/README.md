---
id: whitelabel
kind: platform
status: mock
depends_on: [organizations-partners]
capabilities: []
permissions: Partner Admin (partner.role), not the access model
code:
  - ui-mock/src/lib/whitelabel.ts
  - ui-mock/src/pages/Whitelabel.tsx
  - ui-mock/src/data/partner.ts
  - ui-mock/src/main.tsx
related: [organizations-partners, marko, sales, home-reports, integrations]
last_verified: 105911e
---

# Whitelabel

A Partner's name, logo, colour, domain and email sender replace OpenMarko's on everything its Clients see: the app, reports, shared audits, emails and the assistant. With it on, nothing says OpenMarko or Marko; the assistant is "AI Assistant" unless the Partner renames it. Set once per Partner, never per Organization ([ADR 0004](../../decisions/0004-whitelabel-per-partner.md)).

**Status: `mock`.** Branding applies live across the app in the mock. Domain, SSL and email verification are simulated.

## What it can do

| Capability | State |
|---|---|
| On/off switch | `mock` |
| App name (blank → Partner name) and assistant name (blank → "AI Assistant") | `mock`, applied everywhere through `product()` / `assistant()` |
| Wide logo (sidebar, sign-in, reports, audits) and square icon (favicon, badges, report footer) | `mock`, stored as data URLs |
| Accent colour, applied to CSS variables | `mock` |
| Tab title and favicon (letter tile if no icon; never our mark) | `mock` |
| Custom domain with CNAME and SSL | **stub**: "Check DNS" flips to Live on a timer |
| Fallback address `{slug}.openmarko.com` | **stub**: shown only |
| Email sender name and from address with DNS verification | **stub** |
| Support link replacing ours | `mock` field |
| Managed email/phone providers renamed to "{product} sending / numbers" | `mock` |
| DNS records for Clients point at a neutral zone (`mailedge.net`), not ours | `mock` |

## How it connects

- Every user-facing product or assistant name goes through `lib/whitelabel.ts`.
- [marko](../../features/marko/), [sales](../../features/sales/) (shared audits), [home-reports](../home-reports/) and [integrations](../integrations/) all read it.
- User guides are written whitelabel-neutral because of this.

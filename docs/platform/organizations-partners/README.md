---
id: organizations-partners
kind: platform
status: mock
depends_on: []
capabilities: []
permissions: [setup, organization]
code:
  - ui-mock/src/data/org.ts
  - ui-mock/src/data/partner.ts
  - ui-mock/src/data/mock.ts
  - ui-mock/src/lib/setup.ts
  - ui-mock/src/lib/scope.ts
  - ui-mock/src/pages/Settings.tsx
  - ui-mock/src/pages/Whitelabel.tsx
related: [access-roles, whitelabel, onboarding, app-shell]
last_verified: 105911e
---

# Organizations & Partners

The structure everything hangs off. An **Organization** is the business being marketed; it has **Locations** (each with at most one Google profile), **Websites** (each serving one or more Locations) and **Accounts** on social Platforms. A **Partner** (agency, consultant, reseller) manages many Organizations as **Clients** and puts its brand on the app. See [GLOSSARY.md](../../../GLOSSARY.md).

**Status: `mock`.** The structure is modelled and the settings pages work in memory. There's one real dataset (Maple & Main Dental); other Organizations reuse it.

## What it can do

| Capability | State |
|---|---|
| Organization switcher with every Organization the Member belongs to | `mock` (list is hardcoded by plan) |
| Add organization (from switcher or ⌘K) → onboarding | `mock`: adds to the switcher, shows Maple & Main's data |
| Settings → Locations: add, edit, delete; pick which Website serves it; connect its Google profile | `mock`, in memory |
| Settings → Websites: add by address, pick Locations served; Search Console, GA4, WordPress | `mock`, in memory |
| Accounts per Platform, optionally tagged to one Location | `mock` (managed in Integrations) |
| Partner settings (Partner Admins only): Whitelabel, Clients, Partner team | `mock` |
| Clients list with **Transfer out** (Client keeps its data, leaves the Partner) | `mock`: removes from switcher until reload |
| Plans: Local vs Agency | `mock`: `member.plan` constant |

## How it connects

- **Scope** ([app-shell](../app-shell/)) picks one Location or all; Location pages and Website pages follow it.
- **Access** ([access-roles](../access-roles/)): Members belong to Organizations; Partner staff reach Clients.
- **Whitelabel** ([whitelabel](../whitelabel/)) is per Partner and covers all its Clients.
- **Onboarding** ([onboarding](../onboarding/)) creates an Organization and finds its Locations, Websites and Accounts.

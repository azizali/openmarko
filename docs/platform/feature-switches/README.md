---
id: feature-switches
kind: platform
status: mock
depends_on: [organizations-partners]
capabilities: []
permissions: organization.update
code:
  - ui-mock/src/data/features.ts
  - ui-mock/src/lib/features.ts
  - ui-mock/src/pages/Features.tsx
  - ui-mock/src/components/Layout.tsx
related: [access-roles, app-shell, automation]
last_verified: 105911e
---

# Feature switches

Settings → Features turns modules and features on or off per Organization. A feature works only if it's on, its module is on, and (for Inbox and Campaigns) Email or Texting is on. Turning something off hides its pages and the controls for it inside other features; nothing is deleted, and turning it back on restores everything.

**Status: `mock`.** Fully clickable; stored in this browser.

## What it can do

| Capability | State |
|---|---|
| Every module and feature with an on/off switch, whether its account is connected, and what changes when it's off | `mock` |
| Off hides pages from sidebar, ⌘K and Settings; direct links show an "is off" page | `mock` |
| Off removes in-page controls elsewhere (Send to campaign, Make creatives, Text/Email in reply box, Home blocks…) | `mock` |
| Turning off something others rely on lists them first (`knockOn`) | `mock` |
| Agency-only features (Prospecting, Outreach) only on the Agency plan | `mock` |
| Off also stops background jobs | `idea`: real build only |

## How it connects

The first of three checks ([ADR 0006](../../decisions/0006-three-separate-checks.md)): **on?** (here) → **allowed?** ([access-roles](../access-roles/)) → **connected?** ([app-shell](../app-shell/) § Needs). Every feature's README lists what changes when it's off.

---
id: outreach
kind: feature
module: sales
status: mock
agency_only: true
depends_on: [sales]
connection: sequencer
capabilities: [leads.push, leads.replies, leads.labels]
permissions: outreach
code:
  - ui-mock/src/pages/Outreach.tsx
  - ui-mock/src/components/Outreach.tsx
  - ui-mock/src/lib/outreach.ts
  - ui-mock/src/data/sequencers.ts
related: [sales, integrations, automation, brand-skills]
last_verified: 105911e
---

# Outreach

Send prospects to a cold email sequencer (PlusVibe recommended, Instantly, Smartlead) with their audit link, and answer replies. Page: `/outreach`; settings at **Settings → Outreach**.

**Status: `mock`.**

## What it can do

| Capability | State |
|---|---|
| **Connect**: paste API key (+ workspace ID for PlusVibe), see sending inboxes and warmup, register webhooks, pick a default campaign or create "OpenMarko · Local audit" (3 steps around `{{audit_url}}`) | **stub** |
| **Send to campaign** from the Prospecting selection bar, expanded rows and the audit page: skips no email, unverified email or already in a campaign; previews each step with that prospect's numbers; creates the share link | `mock` |
| Review off ("next time, send in one click", or Settings → Outreach): one prospect goes straight to the default campaign | `mock` |
| Lead status on prospect rows and audits | `mock` |
| **Replies** unibox: threads from every inbox, audit opens beside them, Interested / Meeting booked / Not interested labels, assistant-drafted reply sent from the thread's inbox | **stub** |
| **All leads** list | `mock` |
| Settings → Outreach: connection, campaigns, inboxes, sending rules (verified only, alert on audit open), booking link, `{{variables}}` | `mock` |
| Autopilot: "Send prospects to your default campaign" | `mock` |

## How it connects

Fed by Prospecting. Off: Prospecting stays; "Send to campaign" and sequence badges leave prospects and audits.

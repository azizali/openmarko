---
id: customers
kind: module
status: mock
depends_on: []
capabilities: [bookings.read]
permissions: customers
code:
  - ui-mock/src/pages/Contacts.tsx
  - ui-mock/src/components/Crm.tsx
  - ui-mock/src/lib/crm.ts
  - ui-mock/src/data/contacts.ts
related: [email, sms, inbox, campaigns, workflows, ads, integrations]
last_verified: 105911e
---

# Contacts & messaging (module) and Contacts (CRM)

The CRM, and email, texts and calls with customers. The module's page is **Contacts** (`/contacts`): one record per person who has called, filled a form, booked or visited, with every email, text, call and visit on their timeline. The pipeline is a view of the same records by stage, not a second database.

**Status: `mock`.**

## What it can do

| Capability | State |
|---|---|
| Lists (saved filters) on the left: new leads, ad leads, due for a cleaning, no-shows… | `mock` |
| Sortable table or **Pipeline** board (New lead → Contacted → Booked, Lost; drag to move) | `mock` |
| Selection bar: text or email them (starts a campaign), start a workflow, move stage, tag, export | `mock` |
| Contact drawer: details, consent per channel, tags, full timeline, reply box, "Open in Inbox" | `mock` |
| Sources: Meta ad, Google ad, website form, phone call, Google profile, referral, booking system | `mock` |
| People arriving from ads, forms, calls and the booking system | **stub**: seed contacts only |

## Features in this module

| Feature | Doc |
|---|---|
| Email | [email](../email/) |
| Texting | [sms](../sms/) |
| Inbox (needs Email or Texting) | [inbox](../inbox/) |
| Campaigns (needs Email or Texting) | [campaigns](../campaigns/) |
| Workflows | [workflows](../workflows/) |

Settings section owned: **Email & texting** (`/settings/messaging`).

## How it connects

- **Fed by:** Ads (leads), booking system, website forms, call tracking.
- **Feeds:** Ads (bookings reported back as conversions), Workflows (every change to a contact is an event).
- **Health data:** patient records are health information; sending providers need a BAA before real patients go in.

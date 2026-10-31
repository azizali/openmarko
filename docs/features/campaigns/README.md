---
id: campaigns
kind: feature
module: customers
status: mock
depends_on: [customers, "email or sms"]
capabilities: [email.send, sms.send]
permissions: campaigns
code:
  - ui-mock/src/pages/Campaigns.tsx
  - ui-mock/src/lib/crm.ts
  - ui-mock/src/data/messaging.ts
related: [customers, email, sms, workflows, brand-skills]
last_verified: 105911e
---

# Campaigns

One email or text to a list, sent once. Pages: `/campaigns`, `/campaigns/:id`.

**Status: `mock`.**

## What it can do

| Capability | State |
|---|---|
| Editor: channel, audience (who'll get it, who's skipped and why) | `mock` |
| Message with merge fields (`{{first_name}}`, `{{location}}`, `{{booking_link}}`…) and the assistant's draft | `mock` |
| Checks: SMS segments, link shorteners, treatment names, brand rules | `mock` |
| Send now or schedule; live preview per recipient | `mock` |
| Sent stats: delivered, opened, replied, booked, opt-outs | **stub** |

## How it connects

Needs Email or Texting. Started from Contacts' selection bar. Off: Text and Email leave the Contacts selection bar. Blocked with a link to setup until a channel is ready.

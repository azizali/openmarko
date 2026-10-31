---
id: inbox
kind: feature
module: customers
status: mock
depends_on: [customers, "email or sms"]
capabilities: [email.receive, sms.send, calls.route, social.inbox]
permissions: inbox
code:
  - ui-mock/src/pages/Inbox.tsx
  - ui-mock/src/lib/crm.ts
  - ui-mock/src/components/Crm.tsx
related: [customers, email, sms, workflows, automation, brand-skills]
last_verified: 105911e
---

# Inbox

Every text, email and call with every contact, one thread per person whatever the channel. Page: `/inbox`.

**Status: `mock`.**

## What it can do

| Capability | State |
|---|---|
| Filters: Needs reply, **Calls to make** (call tasks from workflows, with the script), All; channel filter | `mock` |
| Reply by Text or Email, log a Call, or add a Note from one box | `mock` |
| Assistant's draft when it's their turn | **stub** |
| Autopilot: "Answer simple questions in the Inbox" (hours, insurance, directions, booking link) | `mock` setting |
| Social comments and DMs in the Inbox (`social.inbox`) | `idea`: capability defined, not shown |

## How it connects

Needs Email or Texting. Fed by Workflows (call tasks), Campaigns (replies). Off: "Open in Inbox" leaves the contact drawer.

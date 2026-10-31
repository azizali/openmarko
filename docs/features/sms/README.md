---
id: sms
kind: feature
module: customers
status: mock
depends_on: [customers]
connection: texting
capabilities: [sms.send, calls.route]
permissions: sms
code:
  - ui-mock/src/components/Sending.tsx
  - ui-mock/src/data/providers.ts
  - ui-mock/src/data/messaging.ts
related: [inbox, campaigns, workflows, integrations]
last_verified: 105911e
---

# Texting (and calls)

Text from a local number per Location, and route calls and voicemail. Set up in **Settings → Email & texting → Texting & calls setup**.

**Status: `mock`.**

## What it can do

| Capability | State |
|---|---|
| Provider: built-in numbers, Twilio or Telnyx | `mock` |
| Per Location: new local number (search by area code), text-enable the current number, or port it | **stub** |
| A2P 10DLC brand and campaign registration, prefilled | **stub** |
| Quiet hours, opt-out line | `mock` |
| Calls: forward to the front desk, record calls, voicemail to text | `mock` settings |
| Patient privacy note | `mock` |

## How it connects

Powers Campaigns, Workflow text steps, Inbox replies, missed-call events. Off: Text leaves the reply box, campaigns and the step list; text steps in workflows are skipped.

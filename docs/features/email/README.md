---
id: email
kind: feature
module: customers
status: mock
depends_on: [customers]
connection: email_sending
capabilities: [email.send, email.receive]
permissions: email
code:
  - ui-mock/src/components/Sending.tsx
  - ui-mock/src/data/providers.ts
  - ui-mock/src/pages/Settings.tsx
related: [inbox, campaigns, workflows, integrations]
last_verified: 105911e
---

# Email

Send email to contacts from the Organization's own domain, through the built-in sender or its own provider. Set up in **Settings → Email & texting → Email setup**.

**Status: `mock`.**

## What it can do

| Capability | State |
|---|---|
| Provider choice: built-in sending, Amazon SES, Resend, Mailgun, Postmark, SendGrid | `mock` |
| API keys per provider | **stub** |
| Sending domain (a `mail.` subdomain suggested), DNS records with copy, "Add them for me" for Cloudflare, Check now → verified | **stub** |
| Webhooks and reply routing | **stub** |
| From name, from address, reply-to, footer | `mock` |
| Privacy note per provider (BAA) | `mock` |

## How it connects

Powers Campaigns, Workflow email steps and Inbox replies. Off: Email leaves the reply box, campaigns and the step list; email steps in workflows are skipped. Campaigns and Inbox need Email **or** Texting.

# Email: technical

## Code map

| File | Role |
|---|---|
| [components/Sending.tsx](../../../ui-mock/src/components/Sending.tsx) | Email setup flow |
| [data/providers.ts](../../../ui-mock/src/data/providers.ts) | `emailProviders` (fields, where to find keys, privacy), `dnsRecords` |
| [data/messaging.ts](../../../ui-mock/src/data/messaging.ts) | `Channels.email` |
| [lib/crm.ts](../../../ui-mock/src/lib/crm.ts) | Setup state, `disconnectEmail` |

```ts
Channels.email = { provider; region?; domain; verified; fromName; fromAddress; replyTo; records: DnsRecord[]; footer };
```

## Permissions (`email`)

view (see setup) · connect (set up the sending domain, manage).

## Real build

Per provider (from data/providers.ts): SES (IAM key, Easy DKIM 3 CNAMEs, custom MAIL FROM, SNS for bounces/complaints/deliveries, receipt rule for replies; HIPAA-eligible under AWS BAA), Resend (/domains, webhooks, receiving), Mailgun (region, /v4/domains, Routes), Postmark (DKIM + Return-Path, inbound stream), SendGrid (Sender Authentication, Event Webhook, Inbound Parse). Events normalized to `email.*`.

# Contacts (CRM): roadmap

## Current state

Contacts table, pipeline, lists, selection actions, drawer with timeline (`83e1f32`).

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| Contacts and timelines | Seed data in `gw-crm`. |
| Leads arriving from ads, forms, calls | Not wired; seed only. |
| Import / export | Not implemented beyond the button. |

## To build

1. Contacts/events tables per Organization.
2. Ingestion: booking system sync, lead form and website form webhooks, call tracking.
3. Consent capture and audit.
4. Booking → conversion reporting to Ads.
5. BAA coverage.

## Open questions

- Which booking systems first (NexHealth, Open Dental, others for non-dental)?
- Dedupe rules when one person arrives from several sources.

## Changelog

- `83e1f32` "feat: CRM, email".

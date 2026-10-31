# Whitelabel: roadmap

## Current state

Brand switch, name, assistant name, logo, icon, accent, title and favicon all apply live in the mock. Domain and email sections walk through the flow with simulated verification.

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| Custom domain goes Live with SSL | Status flips after "Check DNS"; no DNS lookup, no certificate. |
| Email from address verified | Flips on "Verify"; records come from the managed email record generator. |
| Fallback host | String; nothing is served there. |
| Brand applies to Clients | Stored in this browser only; there is one browser, one Partner. |
| Emails (invites, digests, reports) branded | No emails are sent anywhere in the mock. |

## To build

1. Partner whitelabel table; host → Partner resolution at the edge.
2. Server-rendered title/favicon/theme to avoid flashing ours.
3. Custom domains with automatic SSL.
4. Partner email domain verification; transactional email through it.
5. Neutral DNS zone for Client-facing records.
6. Branded shared audit pages and PDF reports.

## Open questions

- Do Partners on a lower tier get whitelabel, or only some parts (e.g. name but not domain)?
- Can a Client's own Members (not Partner staff) tell they're on a reseller? (Today: no.)

## Changelog

- `1a95797` "feat: white lable and skills update": whitelabel store, Settings → Whitelabel, Clients.

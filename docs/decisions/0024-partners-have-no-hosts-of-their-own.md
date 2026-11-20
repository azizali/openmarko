# 0024. Partners have no hosts of their own

- Status: Accepted
- Date: 2026-11-08
- Affects: partners, identity, server
- Supersedes: the hosts part of [0004](0004-whitelabel-per-partner.md)

## Context

ADR 0004 let a Partner show its brand on a domain it controls, proved by a DNS record. That one feature needed a table, DNS verification, a public brand-by-host route, and a kernel hook that widened CORS and Better Auth's origin check at request time. The boilerplate doesn't need it yet.

## Decision

- A Partner's brand follows the Organization being worked in: a Partner and its Clients see it, nobody else does. The rest of ADR 0004 stands.
- Hosts are gone: the `partners.domains` table, its routes, `/api/v1/brand`, and the kernel's `trustsOrigin` hook.
- Browser origins are only the configured ones (the app, the site, `TRUSTED_ORIGINS`).

## Consequences

- The app shows its own brand until someone has an Organization open, so sign-in pages are never a Partner's.
- A migration drops the table. Any hosts already claimed are lost, and a Partner that wants its domain back has to prove it again.
- Bringing hosts back means a new table and routes, and an origin check that isn't a fixed list.

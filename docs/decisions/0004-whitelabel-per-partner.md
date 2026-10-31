# 0004. Whitelabel is per Partner and belongs to the session

- Status: Accepted
- Date: 2026-10-31 (recorded)
- Affects: platform/whitelabel, platform/organizations-partners, features/marko, features/sales

## Context

Agencies resell the app. Their clients must never see OpenMarko or Marko, including in the tab title, emails, DNS records and shared audits.

## Decision

Whitelabel is set once per Partner, never per Organization. It applies to whoever signs in on the Partner's domain (or `{slug}.openmarko.com`), or is a Member of one of its Clients. With it on, the product takes the Partner's name, the assistant is "AI Assistant" unless renamed, and DNS records point at a neutral zone. The real build resolves it from the request host before the first byte.

## Consequences

- Every user-facing string that names the product or assistant must go through `product()` / `assistant()`.
- User guides are written whitelabel-neutral.
- An Organization that transfers out of a Partner stops seeing the brand.

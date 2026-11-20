# 0028. The chat widget loads from the API, on no server of its own

- Status: Accepted
- Date: 2026-11-08
- Affects: ai, web, chat-widget

## Context

The embed code pointed at the web app's address, which forwards `/widget` and `/api` to the API. That forwarding exists so a member's session cookie stays first-party. Visitors have no cookie: they use a signed token. So every visitor message took an extra hop for nothing, and in development Vite answered the cross-origin preflight itself, without the header a website needs, so a website's first message failed.

Customers paste the embed code once, and it can't be changed for them afterwards.

## Decision

- The API keeps serving the widget. The script is one small file; the work is the chat, which needs the API's database, origin checks, visitor tokens and limits.
- The embed code loads from the API's own address, `BETTER_AUTH_URL`. The script calls whichever origin it was loaded from, so the widget needs no other setting.
- The API builds the embed code and returns it with each assistant, so no fork has to configure the web app with the API's address.

## Consequences

- `BETTER_AUTH_URL` is now part of a promise to customers: changing the API's domain after websites have pasted the code breaks them, unless the old domain keeps serving the API.
- The `/widget/*` rewrite in `apps/web/vercel.json` stays so that snippets pasted earlier keep working.
- If the script's traffic grows, a CDN goes in front of `/widget/v1.js`. If visitor chats slow the app, a second copy of the same API takes `/api/v1/widget/*`. Neither needs a new service.

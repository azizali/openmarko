# 0001. Build the product as a clickable mock first

- Status: Accepted
- Date: 2026-10-31 (recorded; the decision predates it)
- Affects: everything

## Context

The product covers many areas (SEO, social, ads, CRM, prospecting) and many third-party APIs. Building backends before the product shape is settled would mean rebuilding them.

## Decision

`ui-mock/` is a React + Vite app with typed mock data and no backend. `HashRouter` keeps it deployable as static files. Every shape in `data/mock.ts` mirrors what the real service layer will return, and `lib/api.ts` lists the real endpoint each one maps to. Stores keep state in `localStorage` or in memory, and timers stand in for webhooks, so flows can be clicked end to end.

Files with no React imports (`data/access.ts`, `data/integrations.ts`, `data/features.ts`) are written so the server can import them unchanged.

## Consequences

- A screen that works in the mock is **not built**. Docs mark these as stubs ([docs/README.md](../README.md#status)).
- Pages can be wired to a backend one call at a time without changing components.
- Credentials (DataForSEO Basic auth, Google OAuth, provider keys) must never move into the browser when the backend arrives.

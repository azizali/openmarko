# 0011. A Partner is an Organization; access is only member rows

- Status: Accepted
- Date: 2026-10-31
- Affects: platform/organizations-partners, platform/access-roles, platform/backend

## Context

A Partner needs members, invitations, roles, a subscription and a sign-in context, which are exactly what Better Auth's organization plugin gives an Organization. Agency staff need access to many Clients, just as anyone can belong to many Organizations. The mock had a separate `Staff` list with a role per Client.

## Decision

- Users are one flat table. **Access to any Organization is a `member` row with one Role.** Nothing else grants access.
- A Partner is stored as an Organization. A Client points at it with `partner_id`. What lets an Organization have Clients and whitelabel is its Plan's `partner` Entitlement ([0012](0012-billing-module-and-plans-as-data.md)), not a type column.
- Agency staff are members of the Partner's Organization (Partner settings, whitelabel, billing) and have their own member row, with its own Role, on each Client they work on. A Partner Admin can add members to any of its Clients.
- One level only: a Client can't have Clients.

## Consequences

- No staff table, no copied rows, no sync hooks.
- Better Auth's `hasPermission` works unchanged everywhere, because every check is against a member row in the active Organization.
- The Glossary is unchanged: to people using the app, a Partner is still the level above Organizations.
- **Transfer out** is Owner only and shows a warning first: the Partner's brand goes away, and the Partner's Plan stops covering the Client, so it needs its own. The warning lists every agency member (a member of the Client who is also a member of the Partner) with a per-person choice to keep or revoke access. Confirming clears `partner_id` and deletes the member rows chosen for revoke, in one transaction, and logs each in Activity. API: `GET /organizations/{id}/transfer-out` (preview: agency members, what changes), `POST /organizations/{id}/transfer-out { revokeUserIds }`.
- An agency can run its own marketing from its Partner Organization (Locations, Websites) like any business.

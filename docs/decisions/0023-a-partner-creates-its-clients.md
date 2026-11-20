# 0023. A Partner creates its Clients

- Status: Accepted
- Date: 2026-11-08
- Affects: partners, organizations

## Context

A Partner took a Client on by sending a request to an existing Organization's id, which that Organization's Owner accepted. An agency has no way to know that id, and its clients usually have no account yet: the agency sets the client up and then brings them in.

## Decision

- A Partner creates an Organization and, by default, makes it a Client (`partner_id` set at creation). It can opt out and create a separate Organization of its own.
- The person creating it is its first Owner. They bring the client's people in with the ordinary invitation, and can make one of them an Owner on Team.
- There are no requests. The `partners.requests` table, its routes and the `partner.requested` and `partner.declined` events are gone.

## Consequences

- An existing Organization can't become a Client from the app.
- Consent no longer gates the link, so a Client's people learn who manages them from the brand and from Team. Transfer out (ADR 0011) still lets an Owner leave.

# Organizations & Partners: roadmap

## Current state

One fully populated Organization with two Locations and two Websites; switcher, Scope, Locations/Websites settings, Partner settings (Clients, Partner team) and transfer out all clickable.

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| Switching to another Organization | Shows Maple & Main's data; only the name changes. |
| Add organization | Pushes into an in-memory array; no data, gone on reload. |
| Add a Location or Website | Borrows Mueller's sample data; in memory. |
| Plan (Local / Agency) | `member.plan` constant; no billing. |
| Partner role | Hardcoded Admin. |
| Transfer out | Removes the row from the switcher; nothing else moves. |
| `{slug}.openmarko.com` fallback host | String only. |

## To build

1. Tables for organizations, locations, websites, partners; Website ↔ Location join.
2. Per-Organization data everywhere (today most stores are global).
3. Create Organization from onboarding with real discovery.
4. Partner ↔ Client relationship, transfer out (with consent from the Client Owner), transfer in.
5. Plans and billing tied to Organizations / Partners.
6. Rename `business` → Organization in code.

## Open questions

- Who confirms a transfer out: the Partner, the Client's Owner, or both?
- Can an Organization be a Client of a Partner and also have its own billing?
- Limits per plan (Locations, keywords, scans): the Billing page shows sample limits only.

## Changelog

- `ebc6813` "feat: organization": Organization, Locations, Websites, Accounts, Scope.
- `1a95797` "feat: white lable and skills update": Partner, Clients.
- `2442e89` "feat: permissions": Partner team.

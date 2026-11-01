# Organizations & Partners: technical

## Code map

| File | Role |
|---|---|
| [data/org.ts](../../../ui-mock/src/data/org.ts) | `Organization`, `memberships`, `addMembership`, `Website`, `websites`, `websiteFor`, `shortLocation` |
| [data/partner.ts](../../../ui-mock/src/data/partner.ts) | `Partner` (`id, name, slug, role`), `fallbackHost` → `{slug}.openmarko.com` |
| [data/mock.ts](../../../ui-mock/src/data/mock.ts) | `member` (`plan: "local" \| "agency"`), `business`, `locations` |
| [data/scoped.ts](../../../ui-mock/src/data/scoped.ts) | Per-Location / per-Website mock data (Mueller `loc_2` / `web_2` has its own) |
| [lib/setup.ts](../../../ui-mock/src/lib/setup.ts) | What's added and connected: Google Business Profile per Location, Website on/off, Account on/off; add/update/remove Location and Website |
| [lib/scope.ts](../../../ui-mock/src/lib/scope.ts) | `{ orgId, locationId \| null }`, `useScopedLocation`, `useScopedWebsite` |
| [pages/Settings.tsx](../../../ui-mock/src/pages/Settings.tsx) | Locations, Websites sections; section groups (Organization / Partner / You) |
| [pages/Whitelabel.tsx](../../../ui-mock/src/pages/Whitelabel.tsx) | `Clients` (transfer out) |
| [pages/Team.tsx](../../../ui-mock/src/pages/Team.tsx) | `PartnerTeam` |

## Data

```ts
type Organization = { id; name; category; initial };
type Website = { id; domain; locationIds: string[]; tools: { name: "Search Console" | "Google Analytics 4" | "WordPress"; connected; detail }[] };
type Partner = { id; name; slug; role: "Admin" | "Member" };
// Location: see data/mock.ts (id, name, address, coordinates, keywords…)
```

Seed: Organization `org_maple` (Maple & Main Dental) with Locations `loc_1` (South Congress) and `loc_2` (Mueller), Websites `web_1` and `web_2`. Agency plan adds `org_hill` (Hill Country Plumbing) and `org_east` (Eastside Yoga Collective) to the switcher with no data of their own. Partner `ptn_brightline` (Brightline Local).

Settings groups:
- **Organization**: Features, Brand voice, Skills, Locations, Websites, Email & texting, Outreach (agency), Integrations, Autopilot, Schedules, Team, Activity. Travels with the Organization.
- **Partner** (Partner Admin only, hidden while previewing a role): Whitelabel, Clients, Partner team.
- **You**: Profile, Appearance, Notifications, Plan & billing. Follows the person to every Organization.

## State today

All in memory (lib/setup.ts, lib/scope.ts, `memberships` array). Reload resets added Locations, Websites, Organizations and transfers.

## Permissions

`setup.view` / `setup.connect` for Locations, Websites, Accounts. `organization.update` for Features; `organization.delete` is owner-only (no UI). Partner settings check `partner.role === "Admin"`, not the access model.

## Real build

Planned in [backend/schema.md](../backend/schema.md) and [ADR 0011](../../decisions/0011-partner-is-an-organization-row.md):
- Websites are independent of Locations (no link table); the mock's `Website.locationIds` goes away. A Location keeps its Google Business Profile's website link as text only.
- A Location holds its Google Business Profile ID (unique); the Google sign-in is one Connection for the Organization. A Location can exist without one only while the profile is pending connection, and does nothing until then (pages show Connect, jobs skip it).
- A Partner is an Organization that Clients point at with `partner_id`; no `partners` table. Agency staff get access through ordinary member rows. Transfer out shows a warning listing agency members with a keep/revoke choice per person, then clears `partner_id` and removes the revoked members in one step (ADR 0011). The mock's transfer in `Clients` doesn't offer this yet.
- Rename `business` to Organization in code (data/mock.ts).

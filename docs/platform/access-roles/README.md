---
id: access-roles
kind: platform
status: mock
depends_on: [organizations-partners]
capabilities: []
permissions: [member, invitation, ac, team, organization, billing]
code:
  - ui-mock/src/data/access.ts
  - ui-mock/src/lib/access.ts
  - ui-mock/src/pages/Team.tsx
  - ui-mock/src/components/Can.tsx
  - ui-mock/src/components/ViewOnly.tsx
  - ui-mock/src/components/Layout.tsx
  - ui-mock/src/pages/Settings.tsx
related: [organizations-partners, integrations, feature-switches, whitelabel]
last_verified: 105911e
---

# Access & roles (user management)

Who can open an Organization and what each person may do there. Owners and Admins invite people, give each one a Role, and build custom Roles that grant different levels per module or feature (some areas view only, some editable, some allowed to publish or spend). Agencies (Partners) have their own staff who reach Client Organizations without being invited one by one.

**Status: `mock`.** The permission model is complete and is the one meant to ship. The UI to manage people and roles works in the mock. **No authentication exists**, nothing is enforced on a server, and in-page enforcement covers only part of the app. See [roadmap.md](roadmap.md) for the exact state.

## Who uses it

- **Owner / Admin** of a business: invite staff, choose their roles, build roles like "Front desk".
- **Partner Admin** (agency): manage agency staff and which Clients each one can open.
- **Everyone**: sees only what their role allows; disabled buttons explain why.

## What it can do

| Capability | State |
|---|---|
| Four built-in roles: Owner, Admin, Editor, Viewer | `mock`, model final |
| Five levels: None, View, Edit, Publish, Full (manage) | `mock`, model final |
| Custom roles: a base level, a level per module, and per feature either a level or a hand-picked list of actions | `mock`, editor works |
| Duplicate a built-in role to start a custom one | `mock` |
| Delete a custom role; its people move to Viewer | `mock` |
| Invite by email with a role | **stub**: adds an "Invited" row; no email, no accept flow |
| Change a person's role, remove a person, cancel an invite | `mock` |
| Preview as role: the whole app shows what a role sees, with a "Stop preview" bar | `mock` |
| Hide pages the role can't view (sidebar, ⌘K, direct links show "No access") | `mock`, enforced on every feature page |
| "View only" banner on pages the role can see but not change | `mock`, on every feature page |
| Disable individual buttons the role can't use, with a reason tooltip | `mock`, **partial**: only some pages (see roadmap) |
| Settings sections hidden or view-only by role | `mock` |
| Connecting an integration requires the permissions of every capability it implements | `mock` |
| Owner-only actions: delete the organization, change plan and payment | defined in model; **no UI** for either |
| Partner staff: Admin = Admin on every Client; Member = only assigned Clients with a role per Client | `mock` (managed in UI, **not enforced**: you can't sign in as staff) |
| Sign-in, sessions, password reset, SSO, 2FA | `idea`: not in the mock |
| Transfer ownership | `idea`: not in the mock |
| Sub-teams | `idea`: `team` resource exists in the model but is out of the editor |

## How it connects

- **Every feature** declares its actions in `data/access.ts`; a `FeatureId` without actions is a type error.
- **Feature switches** ([feature-switches](../feature-switches/)) are checked first: an off feature is hidden whatever the role.
- **Integrations** ([integrations](../integrations/)): who may connect a provider follows the permissions of its capabilities.
- **Partners** ([organizations-partners](../organizations-partners/)): Partner staff reach Clients through this system.
- **Whitelabel** ([whitelabel](../whitelabel/)): Partner settings (Whitelabel, Clients, Partner team) show only to Partner Admins and hide during preview.

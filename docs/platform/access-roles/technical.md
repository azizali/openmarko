# Access & roles: technical

## Code map

| File | Role |
|---|---|
| [data/access.ts](../../../ui-mock/src/data/access.ts) | The model: tiers, levels, every resource's actions, groups, `RoleSpec`, `compile`, presets. No React imports, so the server can import it. |
| [lib/access.ts](../../../ui-mock/src/lib/access.ts) | The store: people, custom roles, Partner staff, signed-in person, preview. Checks: `can`, `useCan`, `hasPermission`, `viewOnly`, `pageAllowed`, `staffOn`. |
| [components/Can.tsx](../../../ui-mock/src/components/Can.tsx) | `<Can I="post" on="reviews">`: disables the child with a "Your role (X) can't …" title, or hides it with `hide`. |
| [components/ViewOnly.tsx](../../../ui-mock/src/components/ViewOnly.tsx) | Banner above a page the role can see but not change. |
| [components/Layout.tsx](../../../ui-mock/src/components/Layout.tsx) | Filters the sidebar and ⌘K by `pageAllowed`; renders `NoAccess`, `ViewOnly` and `PreviewBar`; gates the assistant on `marko.use`. |
| [pages/Team.tsx](../../../ui-mock/src/pages/Team.tsx) | Settings → Team (People, Roles, role editor drawer) and Settings → Partner team. |
| [pages/Settings.tsx](../../../ui-mock/src/pages/Settings.tsx) | Each section's `needs` (hide) and `edits` (view-only) permission; `sectionAllowed`. |
| [lib/integrations.ts](../../../ui-mock/src/lib/integrations.ts) | `canConnect`, `missingPermission` per provider. |

## The model

```
Tier   = view | edit | publish | manage
Level  = none | Tier                       (UI label for manage is "Full")
Action = { id, label, tier, ownerOnly? }
```

Setting a level grants every action at or below that tier: `view` (see it) → `edit` (draft and change, nothing goes out) → `publish` (post, send, spend) → `manage` (connect, delete, export).

**Resources** = every `FeatureId` (23) plus Organization areas: `brand`, `setup`, `autopilot`, `activity`, `member`, `invitation`, `ac`, `team`, `organization`, `billing`. `member`, `invitation`, `team`, `ac` and `organization` use Better Auth's own action names.

**Groups** (how the editor lays them out): `seo`, `social`, `ads`, `customers`, `sales`, `marko`, `organization`.

```ts
type RoleSpec = {
  id: string; name: string; description: string;
  preset?: boolean;                                   // built in, same everywhere, not editable
  base: Level;                                        // everything without its own setting
  groups: Partial<Record<GroupId, Level>>;            // per module
  resources: Partial<Record<Resource, Level | string[]>>; // per feature: a level, or exact actions
};
```

Resolution (`settingFor`): resource setting → group setting → base. `owner` always gets every action; everyone else never gets `ownerOnly` actions (`organization.delete`, `billing.update`).

`compile(spec)` → `Permission = { [resource]: actionId[] }`, leaving out empty resources. That is Better Auth's permission shape.

### Presets

| Role | Spec |
|---|---|
| Owner | `base: manage`, plus owner-only actions |
| Admin | `base: manage` (no owner-only actions) |
| Editor | `base: publish`, organization group `view`, `brand: edit`, `billing: none` |
| Viewer | `base: view`, `billing: none`, `ac: none` |

Seeded custom roles: **Social media manager** (social publish, SEO view, assistant view, brand view) and **Front desk** (customers publish, assistant view; reviews: view + draft replies only; SEO, email, texting, campaigns view).

## Checks

| Function | Use |
|---|---|
| `can(resource, action)` / `useCan` | The one check everything goes through. |
| `<Can I on hide?>` | Per-control gating in JSX. |
| `hasPermission({ permissions })` | Better Auth's shape; all listed actions must be allowed. |
| `viewOnly(resource)` | Role reaches only `view` on a resource that has more. Drives the banner. |
| `pageAllowed(path)` | Maps a path to its feature (`featureForPage`) and checks `view` (`use` for `marko`). Pages with no feature (Home, Reports, To-do) are open to everyone. |
| `reach(permission, resource)` | Highest tier reached on a resource. |

Settings sections declare `needs: [resource, action]` (hidden without it) and `edits: [resource, action]` (opens view-only without it). Team has no `needs`: everyone can see the team; its controls are gated by `member`, `invitation` and `ac` actions.

## State today

- One store, `localStorage` key `gw-access`: `{ people, roles, staff, me, preview }`. `preview` isn't persisted.
- **The store is global, not per Organization.** The same people and custom roles show on every Organization in the switcher.
- `me` is hardcoded to `p_anika` (Owner). There is no session.
- Partner staff (`Staff`) live in the same store; `staffOn(orgId)` lists them on a Client's Team page. Their access is display-only: no one can act as a staff member.
- IDs are made with `Date.now().toString(36)`.

## Permissions this area uses

| Resource | Actions |
|---|---|
| `member` | create, update, delete (all manage) |
| `invitation` | create, cancel |
| `ac` (roles) | read (view), create, update, delete |
| `team` | create, update, delete (not used in the UI) |
| `organization` | update (settings and Features), delete (owner only) |
| `billing` | view, update (owner only) |

## Real build

From the comments in `data/access.ts` and `lib/access.ts` ([ADR 0003](../../decisions/0003-roles-compile-to-better-auth.md)):

```ts
const ac = createAccessControl(statement);
organization({
  ac,
  roles: Object.fromEntries(presets.map((p) => [p.id, ac.newRole(compile(p))])),
  dynamicAccessControl: { enabled: true },
});
// custom role
createRole({ role, permission: compile(spec) })   // spec saved as an extra field on organizationRole
// check
auth.api.hasPermission({ headers, body: { permissions: { reviews: ["post"] } } });
```

- Tables (Better Auth organization plugin): `member`, `invitation`, `organizationRole` per Organization, with the `RoleSpec` stored beside each custom role so the editor can reopen it and roles **recompile when features are added**.
- Partner staff: no separate table. Each one is an ordinary member row on each Client they work on, with its own Role ([ADR 0011](../../decisions/0011-partner-is-an-organization-row.md)). The mock's `Staff` store goes away.
- Every API route and background job checks `hasPermission`; the client checks stay for UI only.

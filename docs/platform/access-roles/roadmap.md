# Access & roles: roadmap

The plan is to build user management out fully. This page records exactly where it stands.

## Current state

**Designed and final in the mock:**

- The permission model in `data/access.ts`: tiers, levels, per-resource actions for all 23 features and 10 Organization areas, groups, `RoleSpec`, inheritance, `compile` to Better Auth's permission shape, four presets, owner-only actions.
- Settings → Team: People tab, Roles tab, role editor (base, per group, per feature level or exact actions), duplicate, delete with fallback to Viewer, preview as role.
- Settings → Partner team: staff list, Admin/Member, per-Client assignment with a role per Client, invite, remove.
- App-wide page gating: sidebar, ⌘K and direct links respect `view` on the page's feature; "No access" page; "View only" banner.
- Settings sections hide (`needs`) or open view-only (`edits`) by role.
- Integrations: connect/disconnect gated by the capability's permissions.

**Partially done: per-control enforcement.** `<Can>` gates individual buttons on only these files: AdStudio, Campaigns, Citations, Contacts, Profile, Outreach, Rankings, Prospects, Team, Workflows, and the post drawer in components/Social. These pages have **no per-control checks**, so a View-only person sees the banner but the buttons still work: Ads, AdResearch, AiVisibility, Audit, AuditIssue, Autopilot, Brand, CompetitorDetail, Competitors, Content, Factors, Features, Inbox, Integrations (page-level; connect is gated in lib), Keywords, Reports, Skills, SocialPosts, SocialScanner, SwipeFile, Todo, Whitelabel. The assistant's Apply buttons and To-do's Apply aren't gated either.

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| Signed in as Dr. Anika Patel (Owner) | `me: "p_anika"` constant. No auth, no session, no sign-out. |
| Send invite | Adds an `invited: true` row in `localStorage`. No email, no link, no accept step. |
| Each Organization has its own team | One global store; every Organization shows the same people and custom roles. |
| Partner staff open their assigned Clients | Listed only. The signed-in person is never a staff member, so assignments aren't enforced. `partner.role` is hardcoded `"Admin"`. |
| Roles take effect immediately | Only in this browser. Nothing on a server checks them. |
| Plan gates (Agency vs Local) | `member.plan` constant in data/mock.ts. |
| Profile page (Settings → Profile) | Static; Change photo and Manage do nothing. |

## To build

1. **Auth**: Better Auth with the organization plugin. Sign-up, sign-in, sign-out, password reset, email verification. Sessions carry the active Organization.
2. **Per-Organization storage**: `member`, `invitation`, `organizationRole` tables; custom roles per Organization with the `RoleSpec` saved beside them.
3. **Invites end to end**: email (from the whitelabel sender), accept link, expiry, resend, accept into an existing account.
4. **Server enforcement**: `hasPermission` on every API route and background job; register the `statement` and presets from `data/access.ts`.
5. **Finish client gating**: wrap every mutating control in `<Can>` on the pages listed above, plus To-do and assistant Apply (check the action of the feature the task belongs to).
6. **Recompile roles on feature changes**: when a resource or action is added, recompile every saved spec.
7. **Partner staff**: hooks that add/remove member rows on Clients; a staff session that switches between Clients; enforce `staffOn`.
8. **Owner-only flows**: transfer ownership, delete organization, plan and payment changes.
9. **Audit log** of access changes (who changed whose role, invites, removals) in Activity.
10. Later: SSO / 2FA, sub-teams (`team` resource), per-Location access if customers need it.

## Open questions

- Should a Member be restricted to some Locations (e.g. a front desk at one branch)? The model has no Location dimension today.
- Can a person hold different roles on different Organizations they're invited to directly (yes in Better Auth; confirm the UX in the switcher)?
- Does a Viewer see costs and spend (ads, billing usage)?
- Should Partner Members' roles per Client be limited to presets, or can they use the Client's custom roles? (Today: any role in the global list.)
- Invite expiry and who receives "someone joined" notifications.

## Changelog

- 2026-10-31 (`105911e`): Doc created from the mock's current state.
- `2442e89` "feat: permissions": permission model, Team, role editor, preview, Partner team, `<Can>`, page gating.

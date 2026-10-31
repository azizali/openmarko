# App shell & scope: technical

## Code map

| File | Role |
|---|---|
| [App.tsx](../../../ui-mock/src/App.tsx) | `HashRouter`, every route, redirects for old paths. `/onboarding` and `/a/:token` render outside the Layout. |
| [components/Layout.tsx](../../../ui-mock/src/components/Layout.tsx) | Sidebar, switcher, ⌘K, ⌘J, feature/role filtering, `FeatureOff`, `NoAccess`, `ViewOnly`, `PreviewBar` |
| [components/Scope.tsx](../../../ui-mock/src/components/Scope.tsx) | Scope bar, `ExternalUrl` |
| [components/Needs.tsx](../../../ui-mock/src/components/Needs.tsx) | Connect message when a page lacks what it reads |
| [components/RunStatus.tsx](../../../ui-mock/src/components/RunStatus.tsx) | "Updated X ago", live run chip, run button |
| [components/ui.tsx](../../../ui-mock/src/components/ui.tsx) | Buttons, cards, badges, deltas, tabs, drawer, modal, toast, SVG charts |
| [lib/scope.ts](../../../ui-mock/src/lib/scope.ts) | `{ orgId, locationId }`; `useScopedLocation`, `useScopedWebsite` |
| [lib/setup.ts](../../../ui-mock/src/lib/setup.ts) | What's connected; `hasGoogleProfile`, `websiteOf`, `accountConnected` |
| [lib/theme.ts](../../../ui-mock/src/lib/theme.ts) | Dark mode (`gw-theme`), applied before first render |
| [pages/Settings.tsx](../../../ui-mock/src/pages/Settings.tsx) | Section registry (`businessSections`, `partnerSections`, `accountSections`) with `needs` / `edits`; You pages |

## Page guard order (Layout)

1. Feature off (`isOn`) → `FeatureOff` page.
2. Role can't view (`pageAllowed`) → `NoAccess` page.
3. Role is view-only on the page's feature → `ViewOnly` banner above the page.
4. Page itself checks setup → `<Needs>` instead of tools.

## Scope rules

- **Location pages** (Business Profile, Reviews, Rankings, Citations, Competitors, AI answers) show one Location.
- **Website pages** (Site health, Articles, Backlinks) show the Website serving the scoped Location.
- With "All locations" and more than one, they show a comparison table.
- Mueller (`loc_2`, `web_2`) has its own sample data in [data/scoped.ts](../../../ui-mock/src/data/scoped.ts).

## Real build

- Scope in the URL or session so links are shareable.
- `You` settings stored per user; Notifications drive real email/Slack sends.
- Every page toolbar's "Updated X ago" from the latest Run row.

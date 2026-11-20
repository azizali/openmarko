# Decisions

Architecture decision records. One decision per file, numbered in order: `NNNN-short-title.md`. Never renumber; mark a replaced ADR `Superseded by NNNN`.

The first six were written on 2026-10-31 to record decisions already made in the mock's code comments, not new ones. 0001 to 0021 come from the product and platform this boilerplate was carved out of; 0022 is the turn to a boilerplate.

| # | Decision | Status |
|---|---|---|
| [0001](0001-mock-first.md) | Build the product as a clickable mock first | Retired by 0022 |
| [0002](0002-capabilities-not-providers.md) | Features depend on Capabilities, never on a Provider | Accepted |
| [0003](0003-roles-compile-to-better-auth.md) | Roles are levels that compile to Better Auth permissions; no per-person exceptions | Accepted |
| [0004](0004-whitelabel-per-partner.md) | Whitelabel is per Partner and belongs to the session | Partly superseded by 0024 |
| [0005](0005-one-task-store.md) | The assistant, To-do and Autopilot share one task model | Accepted |
| [0006](0006-three-separate-checks.md) | Feature switches, permissions and connections are separate checks | Accepted |
| [0007](0007-backend-stack.md) | Backend stack: Bun, Elysia, Drizzle, Neon, Better Auth, pg-boss | Accepted |
| [0008](0008-modules-by-feature.md) | The backend is a modular monolith, one folder per module | Accepted |
| [0009](0009-events-through-an-outbox.md) | Modules announce events through an outbox table | Accepted |
| [0010](0010-envelope-encrypted-credentials.md) | Provider credentials are envelope-encrypted, apart from Connections | Accepted |
| [0011](0011-partner-is-an-organization-row.md) | A Partner is an Organization; access is only member rows | Accepted |
| [0012](0012-billing-module-and-plans-as-data.md) | Billing is our own module; Plans and Entitlements are data | Accepted |
| [0013](0013-stub-or-live-providers.md) | Every provider adapter has a stub, chosen by config | Accepted |
| [0014](0014-llms-are-integrations-with-a-platform-default.md) | LLMs are an integration; the platform provides a default | Accepted |
| [0015](0015-build-decisions-for-the-backend.md) | Build decisions made while implementing the backend | Accepted |
| [0016](0016-websites-connect-through-a-cms-contract.md) | Websites connect through a CMS contract, not a CMS | Retired by 0022 |
| [0017](0017-one-backend-many-projects.md) | One backend serves many Projects in shared tables; users are not shared | Superseded by 0022 |
| [0018](0018-isolation-by-process-groups-and-cells.md) | Isolation comes from process groups, cells and bulkheads, not microservices | Superseded by 0022 |
| [0019](0019-a-request-is-named-by-its-key-or-its-domain.md) | A request is for the Project its key or its domain names | Superseded by 0022 |
| [0020](0020-production-deploy-with-kamal-from-ci.md) | Production deploys run Kamal from CI, migrating from the deploy machine | Accepted |
| [0021](0021-roles-are-built-from-each-projects-modules.md) | Roles are built from each Project's modules | Superseded by 0022 |
| [0022](0022-a-boilerplate-not-a-platform.md) | A boilerplate to fork, not a platform to host | Accepted |
| [0023](0023-a-partner-creates-its-clients.md) | A Partner creates its Clients | Accepted |
| [0024](0024-partners-have-no-hosts-of-their-own.md) | Partners have no hosts of their own | Accepted |
| [0025](0025-one-chat-widget-for-members-and-visitors.md) | One chat widget for members and visitors | Accepted |
| [0026](0026-forms-open-in-a-side-panel.md) | Forms open in a side panel | Accepted |
| [0027](0027-one-settings-page-in-groups.md) | One Settings page in groups | Accepted |
| [0028](0028-the-widget-loads-from-the-api.md) | The chat widget loads from the API, on no server of its own | Accepted |
| [0029](0029-stub-or-live-is-set-on-the-connection.md) | Stub or live is set on the Connection | Accepted |
| [0030](0030-feedback-beside-the-action.md) | Feedback appears beside the action | Accepted |
| [0031](0031-the-chat-button-uses-a-chosen-widget.md) | The chat button in the app uses a widget someone chooses | Accepted |
| [0032](0032-setup-and-deploy-commands.md) | A fork is set up and deployed by two commands | Accepted |

## Template

```markdown
# NNNN. Title

- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD
- Affects: features/…, platform/…

## Context
## Decision
## Consequences
```

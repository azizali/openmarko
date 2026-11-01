# 0012. Billing is our own module; Plans and Entitlements are data

- Status: Accepted
- Date: 2026-10-31
- Affects: platform/backend, platform/app-shell (Plan & billing), platform/feature-switches, platform/access-roles

## Context

The mock has `member.plan` (`local` | `agency`) as a constant and `agencyOnly` flags on features. The owner wants to create any number of Plans and decide in each what is available and how much, with no code tied to an account type.

## Decision

- `billing` module with a `BillingProvider` interface and two providers: **Stripe** (always real; test mode in development) and **manual** (an admin assigns a Plan with no payment, for comps, invoiced customers and development). Stripe is not stubbed ([0013](0013-stub-or-live-providers.md)).
- **Plans and their Entitlements are rows** (`billing.plans`, `billing.plan_prices`, `billing.plan_entitlements`). An Entitlement is a key and a number:
  - `feature.<FeatureId>`: whether the feature is available
  - `action.<resource>.<action> = 0`: removes an Action for everyone on the Plan, whatever their Role
  - `limit.<name>`: how many (NULL = unlimited)
  - `partner`: may have Clients and use whitelabel
- No code knows about "agency" or "local". `agencyOnly` in features.ts becomes `feature.sales` / `feature.outreach` / `partner` entitlements in seed Plans.
- The subscription belongs to whoever pays: an Organization, or a Partner (whose Plan covers its Clients). Resolution: own subscription → else Partner's → plus `entitlement_overrides`.
- **Metering rule:** every integration that costs us money per use is metered; every integration that is free to use is not. Metered today: DataForSEO, LLM calls, email sending, SMS and calls, ad-platform API calls where priced, and any provider that charges per request or per unit. Free integrations (for example Google Search Console, GA4, and sign-in) write no `usage_events`.
- Each provider adapter declares its cost model in the catalog: `metered: true` with a meter id, or `metered: false`. A new paid provider can't be added without choosing one. Stubs meter the same way, so the numbers can be tested.
- What a Plan charges for a meter is `billing.plan_meters` ([schema](../platform/backend/schema.md)); recording the cost and charging for it are separate.

## Consequences

- New Plans, prices, limits and permission caps need no deploy.
- The Plan is a fourth check beside the three in [0006](0006-three-separate-checks.md): the Plan decides what can be on and what Actions exist; the Organization switches features within that; the Role decides who may do what; Connections decide what can act.
- Limits stop adding more; they never hide existing data.
- The Better Auth Stripe plugin is not used.

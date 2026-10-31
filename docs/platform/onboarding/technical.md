# Onboarding: technical

## Code map

| File | Role |
|---|---|
| [pages/Onboarding.tsx](../../../ui-mock/src/pages/Onboarding.tsx) | The whole wizard (route `/onboarding`, no Layout) |
| [data/org.ts](../../../ui-mock/src/data/org.ts) | `addMembership(name, category)` on Launch |
| [lib/watch.ts](../../../ui-mock/src/lib/watch.ts) | Watched profiles shared with Social scanner |
| [data/watch.ts](../../../ui-mock/src/data/watch.ts) | Suggested profiles (competitors' own accounts) |

## State today

Wizard state is component state. Launch writes to the in-memory `memberships` array and watch list.

## Real build

- Discovery: crawl the website (On-Page API), find Google profiles (DataForSEO business info / Maps), find social links, read reviews, pull nearby searches for keyword suggestions.
- OAuth to Google and Meta during step 4 creates Connections ([integrations](../integrations/)).
- Brand voice draft from Claude ([brand-skills](../brand-skills/)).
- Launch creates the Organization, Locations, Websites, Accounts, tracked keywords, competitors, watched profiles, scanner config and schedules, then starts the first runs.
- Permissions: the creator becomes Owner; on a Partner, the Partner's Admins are added.

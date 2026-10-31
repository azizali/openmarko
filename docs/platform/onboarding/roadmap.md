# Onboarding: roadmap

## Current state

Full wizard clickable (`a89a285`, rebuilt in `4d6367f` for Organizations, Locations, Websites and Accounts).

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| Reading the website and Google | Canned results for Maple & Main. |
| Google / Meta sign-in | No OAuth. |
| Drafted brand voice | Static. |
| Launch creates the business | Adds a name to the switcher only. |

## To build

1. Discovery pipeline (website, Google profiles, socials, reviews, keyword suggestions).
2. OAuth connections in-flow.
3. Create all records and kick off first runs.
4. Billing check (plan limits on Locations and keywords) before Launch.

## Open questions

- Partner onboarding (creating the Partner itself, whitelabel setup) has no flow yet.
- Does a Client added by a Partner get invited Owners at Launch?

## Changelog

- `4d6367f` "feat: better onboarding reflecting the changes".

# Brand voice & skills: roadmap

## Current state

Brand voice page, Skills page, SKILL.md parser and editor are complete in the mock.

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| Voice "learned from" posts, replies and website | Static profile in data/brand.ts. |
| Try it | Canned rewrite, no model call. |
| Public skill index | Hardcoded `publicSkills`. |
| Skills affect what the assistant writes | Mock assistant uses canned text; skills only change labels. |
| Edits persist | In memory; lost on reload. |

## To build

1. Brand profile per Organization, drafted by Claude from the business's own content.
2. Skills storage per Organization; built-ins versioned with the product.
3. Agent Skills loading in the assistant backend.
4. Public skill index (hosting, verification, version pinning).

## Open questions

- Who can publish to the public index, and how is "verified" granted?
- Should Partners share custom skills across all their Clients?

## Changelog

- `671583e` "feat: social preview + skills": Brand voice and Skills.
- `1a95797`: skills update (locked skills, public index).

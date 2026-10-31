# Brand voice & skills: technical

## Code map

| File | Role |
|---|---|
| [data/brand.ts](../../../ui-mock/src/data/brand.ts) | Brand profile: name, category, summary, traits, use/avoid words, examples, audience, services, differentiators, offers, rules, hours, phone, website, locations, signOff, learnedFrom |
| [pages/Brand.tsx](../../../ui-mock/src/pages/Brand.tsx) | Settings → Brand voice (`/settings/brand`; `/brand` and `/social/voice` redirect) |
| [data/skills.ts](../../../ui-mock/src/data/skills.ts) | `Skill` type, built-in SKILL.md sources, frontmatter parser, `PublicSkill` + `publicSkills` |
| [lib/skills.ts](../../../ui-mock/src/lib/skills.ts) | In-memory store: on/off, edits, locks, added public and custom skills; save validation; `builtinOf` |
| [pages/Skills.tsx](../../../ui-mock/src/pages/Skills.tsx) | Settings → Skills |

## SKILL.md format

```markdown
---
name: review-reply
description: When to use it (Claude matches requests on this)
background: [brand, reviews]   # context it needs besides the brand profile
---
Instructions…

## Example
…
```

Built-in skills may carry `locked` (a reason string): editable only as on/off.

## State today

Brand profile static; skills in memory (reset on reload).

## Permissions

`brand.view` to see Brand voice and Skills; `brand.edit` to change them. Settings sections open view-only without `brand.edit`. Page controls are not individually gated (see access-roles roadmap).

## Real build

- Claude reads the last ~50 posts, review replies and website copy and drafts the profile; the owner edits it.
- The brand profile is standing context on every assistant request.
- Each skill is an Agent Skill Claude loads when a request matches its description.
- Public skills: a public index of SKILL.md files; adding one copies it into the Organization pinned to that version.
- Stored per Organization.

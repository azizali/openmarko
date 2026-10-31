# Reviews: technical

## Code map

| File | Role |
|---|---|
| [pages/Profile.tsx](../../../ui-mock/src/pages/Profile.tsx) | Reviews tab, gated with `<Can>` |
| [lib/tasks.ts](../../../ui-mock/src/lib/tasks.ts) | Review replies are Tasks |
| [data/skills.ts](../../../ui-mock/src/data/skills.ts) | `review-reply` (locked: patient-privacy rules) |
| [lib/autopilot.ts](../../../ui-mock/src/lib/autopilot.ts) | `review_replies_good`, `review_replies_bad` |

## Permissions (`reviews`)

view (read) · reply (draft, edit tier) · post (publish) · request (send review requests, publish). The seeded **Front desk** role gets view + reply only, so it drafts for someone else to post.

## Integrations

`reviews.read` (event `review.received`), `reviews.reply`, both per Location, from the Google Business Profile provider.

## Real build

- Profile sync pulls new reviews; low-rating alert (`notify.send`, Notifications → New reviews).
- Reply: `PUT …/reviews/{review}/reply` (v4).
- Assistant drafts with brand voice + `review-reply`; Autopilot level decides post vs To-do.

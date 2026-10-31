# Social media: technical

## Code map

| File | Role |
|---|---|
| [data/social.ts](../../../ui-mock/src/data/social.ts) | `Account`, channels, `Trend`, `Remix`, per-channel remix writer |
| [components/Social.tsx](../../../ui-mock/src/components/Social.tsx) | Channel badge, post drawer (remix / edit); `<Can>` on publish |
| [components/PostPreview.tsx](../../../ui-mock/src/components/PostPreview.tsx) | Per-platform preview |
| [lib/social.ts](../../../ui-mock/src/lib/social.ts) | Post store (see [social-posts](../social-posts/)) |

## Permissions (`social`)

view (social overview) · connect (connect social accounts, publish tier).

## Integrations

Instagram, Facebook (`social.publish`, `social.insights`, `social.inbox`), TikTok, X (`publish`, `insights`), LinkedIn (`publish`), Google Business Profile (`profile.posts`).

## Real build

Meta Graph API (Instagram + Facebook Pages), TikTok Content Posting API, LinkedIn Posts API, GBP `localPosts` per Location. Every draft written with the brand voice through the matching skill.

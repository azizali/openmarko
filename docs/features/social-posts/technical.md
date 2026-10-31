# Posts & calendar: technical

## Code map

| File | Role |
|---|---|
| [pages/SocialPosts.tsx](../../../ui-mock/src/pages/SocialPosts.tsx) | `/social/posts` |
| [lib/social.ts](../../../ui-mock/src/lib/social.ts) | In-memory post store (draft → scheduled → published), stats roll-up |
| [components/Social.tsx](../../../ui-mock/src/components/Social.tsx) | Post drawer; `<Can>` on publish |

```ts
type PostStats = { views; likes; comments; shares };
// SocialPost: one Post, a version per Account, status draft | scheduled | published, stats per Account
```

## Permissions (`social_posts`)

view (calendar) · edit (draft and schedule) · publish (publish posts).

## Real build

`posts` and `post_versions` tables; scheduler publishes via `social.publish` / `profile.posts`; `post.published` / `post.failed` events; insights sync via `social.insights`.

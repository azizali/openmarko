# Articles: technical

## Code map

| File | Role |
|---|---|
| [pages/Content.tsx](../../../ui-mock/src/pages/Content.tsx) | `/content` |
| [lib/content.ts](../../../ui-mock/src/lib/content.ts) | In-memory article store per Website, shared with Reports |
| [data/mock.ts](../../../ui-mock/src/data/mock.ts) | `ContentItem` |

```ts
type ContentItem = { id; title; status: ContentStatus; keywordId; date; metric?; words? };
```

## Permissions (`content`)

view · edit (write and edit) · publish (publish to the website).

## Integrations

`site.write` (WordPress: `publishPost`, `revert`), `search.read` (Search Console clicks), `analytics.read` (GA4).

## Real build

WordPress REST publish with revision for rollback; clicks from Search Console per URL; assistant drafts with brand voice + `blog-article`; articles stored per Website.

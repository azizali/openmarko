# 0016. Websites connect through a CMS contract, not a CMS

- Status: Accepted
- Date: 2026-11-01
- Affects: platform/integrations, features/site-health, features/content, platform/backend
- Builds on: [0002](0002-capabilities-not-providers.md) (capabilities, not providers)

## Context

Customers run their websites on WordPress, Webflow, Shopify, Ghost, or something we've never heard of. Site fixes and article publishing were written against WordPress operation names (`set_title`, `publish_post`), and publishing used whichever site connection the Organization had, not the article's website.

## Decision

- `site.write` is a contract of four typed operations: `publishArticle`, `readPage`, `setTitle`, `setMetaDescription` (`modules/integrations/src/site/contract.ts`). Features call `siteCall(ctx, orgId, websiteId, input)` and never a CMS's own API.
- Each CMS is a **spec**: which operations it supports, and the live call for each. Support may depend on the connection's settings: WordPress edits meta descriptions only when an SEO plugin (Yoast, Rank Math) is named. One builder turns a spec into an adapter, so the stub, the support check and the error shapes are the same for every CMS.
- A CMS connection attaches to **one website**. `siteCall` uses that website's connection, scoped to the Organization, and never falls back to another site's.
- **Custom site** covers any other CMS: each change is POSTed to the customer's endpoint as JSON, signed with HMAC-SHA256 of `<timestamp>.<body>`, and their code applies it.
- What a person enters to connect comes from the provider's catalog **fields**. Secret fields go to the encrypted credentials; the others become the Connection's `settings` (a new non-secret column). Values are checked against the fields when connecting.

## Consequences

- Adding a CMS is a spec and a catalog entry. A contract test runs every CMS's supported operations, and fails if the catalog lists a site.write provider with no spec.
- An operation a CMS can't do is a 409 `unsupported_by_cms` that names the operation, raised when a fix is proposed rather than when it's applied.
- Webflow, Shopify and Ghost run on the stub; their live calls are not written yet (501 when set live). WordPress and the custom site are live-written.
- Published articles keep the CMS's id and URL (`seo.articles.external_id`, `published_url`).

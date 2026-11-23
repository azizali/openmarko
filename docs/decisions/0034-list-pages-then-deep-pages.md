# 0034. A section is one table; detail is a deep page with breadcrumbs

- Status: Accepted
- Date: 2026-11-23
- Affects: web

## Context

The SEO pages had grown layers. Google Maps stacked a stats strip, a keyword card list, a verdict, a Map / Compare profiles / Over time switch, the map, a second stats strip and a leaderboard, with each business in a drawer on top. Keywords led with a headline card and chart and opened rows in place. The marketing site's pictures of the same pages (a title, one line, one table) read far more easily. Much of the detail was also hidden behind the switch or the drawer, so it was easy to miss.

## Decision

1. **A section page is its header and one table.** The header's line under the title is short: one fact or one clause, not a paragraph. Totals go in the table's last row, not in stat tiles above it. Each row carries the columns needed to choose an item, not everything we know about it (amended below); on phones the table stacks (`stack` in `pages/seo/parts.tsx`).
2. **A row opens a deep page, not a drawer**, at a path under its section (`/seo/maps/:keywordId`, `/seo/maps/places/:placeId`, `/seo/keywords/:keywordId`). The deep page shows everything about the item top to bottom, in titled cards, with no switch hiding views. Its header has breadcrumbs back up (`SeoHeader`'s `trail`, drawn by `Breadcrumbs` in `components/ui.tsx`).
3. Drawers stay for **doing** things (adding keywords, Check now), not for reading about one item.

## Consequences

- Every section (Google Maps, Keywords, AI answers, Competitors) looks and works the same, so people learn the pattern once. The overview stays a summary of cards that each open a section, and Settings keeps its side panels, since both are for doing rather than reading one item.
- A filter that changes which rows a table lists (Competitors' channel) stays above the table; it narrows the list rather than hiding detail.
- Every item has a link that can be shared or bookmarked, and the browser's Back works.
- Reading an item is one page load away instead of on the section page; the section table carries enough to choose which one to open.

## Amendment (2026-11-23): fewer columns where a fact belongs to another section's name

Keywords had columns for "Map pack" and "AI Overview": facts about Google's results page for that keyword, read by the Google search check. Beside the Google Maps and AI answers sections, they read as those sections' results, and two more columns made the table heavier. A section table now carries only the columns needed to choose an item; the rest stays on its deep page. The API keeps sending every field per row, so a column can come back without a server change.

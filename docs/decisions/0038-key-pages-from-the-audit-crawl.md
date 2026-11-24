# 0038. Key pages, chosen by a member, get the links to add; both come from the site audit's crawl

- Status: Accepted
- Date: 2026-11-24
- Affects: seo, integrations, web

## Context

Actions was to grow Internal links after the Site audit (ADR 0037): links between the website's own pages that tell
search engines which page to show for a keyword. A first cut had its own tab, picked the page to link to for each
keyword itself, and listed links to pages that are gone. Members found it overwhelming, couldn't tell what it would
do, and asked for what SEO people mean by it: choose the pages that matter ("money pages") and make sure the rest of
the site links to them. The data is the site audit's, so they also asked whether it belongs there.

## Decision

1. **No check of its own.** The site audit's crawl already follows the site's links. DataForSEO's On-Page API serves
   them for the finished crawl (`on_page/links`, internal only, 5,000 at most), so the adapter reads them in the same
   collection and the audit files them (`audit_links`), with each page's main heading. No new capability, no second
   crawl, no extra cost.
2. **Key pages, not money pages,** are chosen by a member: a page of the site (by its path, so http or www doesn't
   matter) and the tracked keywords it should rank for (`key_pages`, `key_page_keywords`; a keyword is for one key page
   at most). The app never decides on its own. It **suggests** pages, three at a time, for keywords no key page is for:
   the page Google shows for the keyword (`serp_results.your_url`), unless that's the home page, else the shallowest
   page about it. A member makes it a key page or turns it down; one turned down isn't suggested again.
3. **A page's subject is read from its address, title and main heading**, not its text and not a model
   (`key-pages/logic.ts`, pure). The city and words that describe the whole site (in the home page's title or heading,
   or on most pages) are left out, so a keyword made only of the trade and the city is the home page's to rank for.
   This is cheap, explainable in the evidence and testable; reading body text would need a call per page, and can
   replace this reader later without a schema change.
4. **Pages to link from** a key page are live pages about one of its keywords that don't link to it yet, the most
   linked-to first, three at most. That's **one suggestion per key page** (`add_link`, source `key_pages`): "Link to
   /services/whitening from 2 pages about …", with the words to link with (its keyword with the most searches that has
   pages to link from). It's done by hand, like a site fix: applying marks it done, Autopilot never does. While open
   it takes the latest pages; a crawl that finds the links, or a key page removed or given other keywords, expires it.
   Choosing or changing a key page refreshes the links to add at once, without the other rules.
5. **It lives in the Site audit,** as a second view beside the issues (`?view=key-pages`), not a tab: one crawl, one
   place, one Audit now. Orphan and deep pages, and links to pages that are gone, stay site audit issues, so nothing
   is listed twice.

## Consequences

- Each audit stores its links. Pruning the audit removes them (`on delete cascade`).
- Nothing is suggested to link until a member has chosen key pages; the suggested ones make that one click.
- Adding a link through a connected site (WordPress, Webflow) is a later step, as for site fixes: `add_link` would then
  be applied by an executor and could be put on Autopilot.
- Backlinks (links from other sites) is a different source with a provider and its own cost, so it will be its own
  capability and Actions tab, feeding the same plan; key pages say which pages other sites' links should reach.

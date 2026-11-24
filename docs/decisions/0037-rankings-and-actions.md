# 0037. SEO is Rankings and Actions; the site audit is a check whose fixes are suggestions

- Status: Accepted
- Date: 2026-11-24
- Affects: seo, integrations, shared, web

## Context

The SEO section was a flat list: Overview, Google Maps, Google search, AI answers, Competitors, Settings. Each page
answers "where do I stand?", and the overview's "What to do next" answered "what do I change?". More ways to act were
coming: a site audit first, then internal links, backlinks and content. Added as more rows to the same list, they would
blur the two questions, and each would grow its own to-do list.

A site audit also had to be fitted in. It needs a provider (a crawl), runs on a schedule, costs money per run, and finds
things to fix. That's what a check already is, and fixing things is what suggestions already are.

## Decision

1. **The section has two halves.** **Rankings** (Google Maps, Google search, AI answers, Competitors) say where you
   stand and who beats you. **Actions** (the Action plan, then the tools that feed it) say what to change. In the
   sidebar the section is called **Search** and has four rows: Overview, Rankings, Actions, Search settings. Rankings
   and Actions are one row each, and every page in them shares one header (`SeoHeader` in `Seo.tsx`): the section's
   name, then its pages as tabs along the header's lower edge, then the page's own line. A deep page (one keyword, one
   issue) keeps the header with its tab selected (the tab is the way back to the list) and shows its own name under
   the tabs; a page further down shows only the steps between ("dentist ›"). Going deeper never leaves the section. The sidebar row lists its pages in
   `NavItem.within`, so it's current on any of them and the command palette offers each. The sidebar stays four rows however many tools Actions grows. Every
   page listed at once (nine rows, with group labels) was tried first and read as too busy.
2. **One queue.** The **Action plan** (`/seo/plan`) lists every open suggestion from every source, filtered by the check
   it should move and by where it came from. The Google profile's suggestions (categories, description, posts) are in
   it, not on a page of their own. A Rankings page's "· 3 actions" opens it filtered to that check. Each new Actions
   tool adds suggestion kinds, not its own list.
3. **A site audit is a check** (`kind = 'audit'`) behind its own capability, `site.audit` (DataForSEO's On-Page API).
   It reuses the cycle, its Run and cost, provider tasks, collection and filing once. A scheduled cycle includes it at
   most weekly; Check now on the Site audit page asks for it; Check now elsewhere means the rankings.
4. **The provider reports facts; the module decides what's wrong.** The adapter returns what each page says (status,
   title, words, load time…) and what the site says about itself (structured data, phones, robots.txt, llms.txt).
   `seo/audit/issues.ts` turns facts into issues and health, comparing the site with the business (its Google profile's
   phone, its tracked services). Rules change without a new crawl or a provider change.
5. **A site fix is done by hand.** The website is the customer's, so a `site_fix` suggestion carries the steps and
   what to paste, and applying it marks it done (a Task, with Undo). Kinds done by hand (`listing`, `site_fix`) are
   never applied by Autopilot. The next audit says whether it took: an open fix whose issue is gone expires, and an
   issue that comes back is a new suggestion (its fingerprint names the audit where its current run began).
6. A suggestion may move several checks (`helpsAll`); `helps` stays the one it moves most.

## Consequences

- People learn one pattern: look under Rankings, act from the Action plan. Reaching one channel from the overview is a
  click on Rankings, then its tab. The chat assistant's propose tools
  (ADR 0036) add to the same queue, and its read tools can read the audit through `audit/results.ts`.
- Internal links, backlinks and content fit the same way: a capability if they need a provider, facts in, issues or
  suggestion kinds out, and a tab under Actions.
- An audit costs what it crawls (500 pages at most, or the Plan's `seo_audit_pages`); the admin cost estimate counts
  one a week for each Location with a website.
- Existing DataForSEO Connections keep the capabilities they were made with, so a migration adds `site.audit` to them.
- Nothing is changed on the customer's site. Applying a fix through a connected site (WordPress, Webflow) is a later
  step and would make `site_fix` applied by an executor, like a profile change.

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: owners of small local businesses (HVAC, plumbing, dental, med spas, law firms, auto repair and similar) who get customers from Google and have paid, or are paying, a marketing agency and feel they got reports instead of results. They run the business themselves and check marketing between jobs, often on a phone.

Secondary: agencies and freelancers who manage local businesses (the Partner plan). They are served by their own pages, not the homepage.

## Product Purpose

OpenMarko does a local business's marketing for it: map pack rankings, Google Business Profile posts, review replies, social posts, website fixes and AI search visibility. Marko, the built-in AI marketer, finds what to do, drafts or does it, and the owner approves. Success is more calls and bookings from Google without hiring an agency.

## Positioning

The anti-agency. "Fire your agency. Marko does it for you." Agencies sell retainers, monthly PDFs and a rotating account manager; OpenMarko shows the actual work, does it weekly, asks before changing anything, and costs a fraction of a retainer, month to month.

## Operating Context

- Owner connects Google Business Profile (and optionally Search Console, Analytics, WordPress, social accounts). Setup about five minutes.
- Weekly 7×7 geo-grid scans per keyword; a To-do list of fixes ranked by impact; Apply or Autopilot per action.
- Marko drafts review replies, Google posts and social posts in the Brand voice; owner approves from a phone or lets trusted kinds post themselves.
- Free audit is the lead magnet: map grid, competitors above you, top fixes.

## Capabilities and Constraints

- Everything is `mock` today: no backend, no real provider calls. The site must not claim live results.
- Words follow GLOSSARY.md: Organization, Location, Google Business Profile (in full), Marko (renamed under Whitelabel; the marketing site always says Marko).
- Pricing and offer live in `site/src/data/site.ts` and are hypotheses to confirm before launch.

## Brand Commitments

- Name: OpenMarko. Assistant: Marko.
- Site and app share one visual system (see `site/src/index.css` and `ui-mock/src/index.css`).
- References the user likes: chatwoot.com, origami.chat, mailcheap.ai.
- Voice: plain words, short sentences, say what it does. Blunt about agencies, never about the customer.

## Evidence on Hand

- No customers yet. Case studies and testimonials in `site/src/data/stories.ts` are samples built from mock businesses and must stay labelled "Sample story" while `SAMPLE_CONTENT` is true.
- Market stats in `site/src/data/site.ts` carry sources (BrightLocal 2026, OpenMarko scan-cost research).
- Any new claim about agency prices or savings is a proposal until the owner confirms it; mark it in code.

## Product Principles

1. Show the work, not a report about the work.
2. Nothing changes without the owner's say-so, unless they turned on Autopilot for it.
3. Honest numbers: real costs, sourced stats, labelled samples.
4. Month to month; the customer can leave with their data.

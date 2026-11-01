# Marketing site: roadmap

## Current state

All pages built with draft copy (`275dc98`).

## Stubbed

| Looks like it works | What's really there |
|---|---|
| Customer stories | Samples from the fictional mock businesses, labelled. |
| Sign-up / Start buttons | Link to `APP_URL`, which doesn't exist yet. |
| Pricing | Hypothesis, not final. |

## To build

1. Final pricing aligned with in-app billing (app Billing page shows a $79 "Growth" plan that doesn't exist here).
2. Real stories and recorded video testimonials (consented); set `SAMPLE_CONTENT = false`.
3. Legal pages; hosting; analytics.
4. Confirm or replace the PROPOSED agency claims in `data/antiAgency.ts` (retainer range, contract length, $2,500/mo typical retainer, yearly savings).
5. Measure the trade dialog once analytics exist: how many pick, skip or close it, and audit requests with and without a picked trade or typed name. Remove the dialog if it costs audits.
6. Swap the ipapi.co city lookup for the host's edge geo header once hosting is chosen, and mention IP geolocation in the privacy policy.

## Changelog

- Hero and final-CTA backdrop grids confined to the 1200px content column, so their outer lines sit on the page rails. Section headings follow the hero: a pink word in Proof, Control and Versus, and one underlined phrase in the Problem and Control subheadings.
- Homepage personalisation settled on the banner. The story is framed as "Follow along: one plumber in Austin"; a once-per-browser dialog asks for the trade (eight plus Other), the city comes from the visitor's IP (ipapi.co), and the name only from the banner. Sentence and search-mock capture variants and the `?capture=` switch removed.
- Personalised homepage: visitors enter business name, city and trade (eight trades) and the whole homepage follows their business, marked as a preview. Three capture variants behind `?capture=sentence|search|banner` for comparison; a "Previewing as" chip rides along once the hero scrolls away.
- Hero social proof rearranged: "1,240 local businesses run their marketing on Marko" as an eyebrow above the headline; "214 audits sent last week" with a live dot under the audit form (placeholder, labelled Sample); a full-width "Owners using Marko" wordmark row along the bottom of the hero, with the rotating "fired their agency" line beside its label so it doesn't compete with the audit CTA. The full-width strip under the hero is removed. The audit form drops its reassurance chips, since the CTA already says free.
- Sourced stats strip under the hero replaced by a social-proof strip: businesses served, joined this week, a rotating "just joined" line, product news, and an "Owners using Marko" row. All numbers are placeholders labelled Sample.
- Display type switched to Archivo (75% width, 800) for every heading and big number site-wide, after bun.com; Frank Ruhl Libre kept for customer quotes and in-app mock screens. One pink word per key headline; hero places underlined in pink and linked to the story (`#how`).
- Homepage rewritten around the anti-agency position for owners; agencies moved to a footer link. Story covers Maps, Google search and AI answers. Slimmer header, headings and section spacing site-wide. `PRODUCT.md` added at the repo root.
- `275dc98` "feat: marketing site".

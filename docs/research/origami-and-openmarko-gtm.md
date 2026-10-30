# Origami (origami.chat) teardown + OpenMarko go-to-market plan

_Researched 2026-10-30 from first-party pages. Every claim about Origami or a vendor links to its source. Company-reported numbers are the company's own claims and were not independently verified. Lines marked **Inference** are my reasoning, not something a source states._

## Executive summary

1. **What Origami is:** an AI prospecting and outbound tool. You enter your website (or describe your business); it builds an ICP, finds leads across "50+ sources", verifies contacts with "10+ providers", writes one-to-one messages and sends them from inboxes it sets up ([home](https://origami.chat/)).
2. **Founding:** YC Fall 2024, San Francisco, team of 10. Founders are Finn Mallery (CEO) and Kenson Chung ([YC](https://www.ycombinator.com/companies/origami-2)). It raised a $2M seed and reported $50K MRR during an 8-week beta ([VentureBeat](https://venturebeat.com/ai/y-combinators-hottest-startup-origami-agents-secures-2m-seed-round-to-supercharge-sales-teams-with-ai/)).
3. **The "10,000 businesses" figure is real, but only on one page.** The YC profile says "used by 10,000+ businesses" ([YC](https://www.ycombinator.com/companies/origami-2)). Origami's own homepage says **2,000+** ([home](https://origami.chat/)), and its X profile says **1,000+** ([X via proxy](https://r.jina.ai/https://x.com/origamichat)). Treat all three as marketing claims.
4. **Pricing:** a flat monthly fee that includes **more dollar-denominated usage than you pay**. Starter is $99 for $165 of usage, Pro is $199 for $330 and Max is $399 for $660. Seats are unlimited, contact data is billed at cost ($0.066 per verified email, $0.33 per verified phone), and top-ups get cheaper on higher tiers ([pricing](https://origami.chat/pricing)).
5. **The "all-in-one machine" is mostly bought, not built.** It uses a 5-provider email waterfall and a 9-provider phone waterfall, scrapes through Apify, stores data in Supabase and runs on Claude ([pricing](https://origami.chat/pricing), [PH Built with](https://www.producthunt.com/products/origami-chat/built-with)). It also reads website visitors from PostHog, connects to HubSpot, Salesforce and Attio read-only for dedup, and includes its own email and social sequencer.
6. **Local business is a headline vertical.** Origami searches Google Maps directly, uses state license registries to find owners, and qualifies businesses by rating, review count and review velocity ([local business](https://origami.chat/products/local-business)). It has **134 `/for/<industry>` pages**, 30 of them for home services ([/for](https://origami.chat/for)).
7. **How it grew (evidence):** the Launch YC post, a Garry Tan-posted Product Hunt launch (#1 Product of the Day on 2026-02-19, 491 upvotes), "organic growth… no paid marketing spend", 1,000+ signups in February 2026, programmatic vertical and comparison pages, a long outbound playbook, a 15% affiliate program and frequent feature launches ([PH](https://www.producthunt.com/products/origami-chat/awards), [CMOtech](https://cmotech.uk/story/origami-launches-chat-based-ai-tool-for-sales-leads), [partners](https://origami.chat/partners)).
8. **OpenMarko already has the hard part Origami lacks for local:** a proof-of-value **audit**, with geo-grids, competitor gaps, a projected rank and missed revenue. Origami's own playbook says the best cold offer "does some of the work up front" ([guide](https://origami.chat/guide)). That is exactly what an OpenMarko audit is.
9. **Recommendation: sell now and build only the five missing links in the loop.** Those are a shareable audit page with view tracking, sending from your own mailbox with 3 follow-ups (or a push to Instantly), a pipeline status per prospect, a booking link, and Stripe checkout that turns a prospect into a workspace. Everything else waits until there are 10 or more paying customers.
10. **90-day target:** one niche in one metro (for example HVAC in Austin), about 25 founder-written audit emails a day, 10 to 20 paying locations by day 60, two published before-and-after case studies by day 90, then the same loop packaged for agencies.

---

## Part A: Origami research

### A1. Problem and ICP

- **Problem they name:** "Outbound sales in 2024 is broken. Response rates have hit rock bottom and quotas are going unmet." Everyone pulls from the same databases and the same signals ([Launch YC](https://www.ycombinator.com/launches/MFd-origami-find-who-s-looking)).
- **Promise:** "Origami gets customers for you." Enter a website and it finds likely buyers, writes to each one and sends replies to your inbox. Setup takes about 10 minutes, with no per-seat fees ([home](https://origami.chat/)).
- **ICP:** broad. The homepage says "five-person teams to the Fortune 500" ([home](https://origami.chat/)). Use-case segments are SDRs and AEs, Marketing, Demand Gen and PMM, RevOps, and Agencies and Consultants ([use cases](https://origami.chat/use-cases)). The early focus was property management and real estate before expanding to other B2B verticals ([VentureBeat](https://venturebeat.com/ai/y-combinators-hottest-startup-origami-agents-secures-2m-seed-round-to-supercharge-sales-teams-with-ai/)). Today it markets heavily to sellers who target **local businesses**, which it says Apollo and ZoomInfo miss ([local business](https://origami.chat/products/local-business)).
- **Logos shown:** Google, Salesforce, Bloomberg, CBRE, Mercury, Cognition, Rho, Redesign Health and HockeyStack ([home](https://origami.chat/)).

### A2. Product, end to end

| Stage | What Origami does | Source |
|---|---|---|
| 1. Define | Enter your website and it infers your best customers, or you describe the business. An ICP builder is also available. | [home](https://origami.chat/) |
| 2. Find | You write a plain-English prompt, for example "Find roofing companies in Dallas with 10+ employees and a 4-star Google rating". The AI picks sources and fills a spreadsheet you can refine by chat, with a "Find More" button. Claims include "15+ live sources", "up to 500 results" and "45–90 seconds per search". | [AI prospecting](https://origami.chat/products/ai-research-agents), [outbound](https://origami.chat/products/outbound) |
| 3. Sources | Social profiles, Google Maps, 100+ job boards, Shopify and WooCommerce stores, tech-stack databases, funding data, news, X, Crunchbase and BuiltWith. The local search also covers state license registries. The blog adds Google Business Profiles, Yelp, state directories and licensing boards. | [AI prospecting](https://origami.chat/products/ai-research-agents), [outbound](https://origami.chat/products/outbound), [local](https://origami.chat/products/local-business), [blog](https://origami.chat/blog/origami-lead-generation-2026) |
| 4. Qualify | You set criteria and each row is marked pass, fail or unsure. Local filters cover rating, review count, review velocity and Google category, and separate single-location businesses from franchises. Revenue and employee counts are inferred from review volume, profile completeness and business age. | [AI prospecting](https://origami.chat/products/ai-research-agents), [local](https://origami.chat/products/local-business) |
| 5. Signals ("Plays") | Plays are groups of people with a reason to hear from you, such as new offices, pricing-page visitors or growing teams. Signals cover jobs, funding, social posts, tech-stack changes, company growth, creator activity, moves, events, competitors, past customers and reviews. | [home](https://origami.chat/), [signals](https://origami.chat/products/signal-detection) |
| 6. Warm leads | Website visitors come from **PostHog** (company-level only, $0.11 per company delivered, about 25% of human traffic resolves). The tool also covers your network, former customers from Stripe or a CRM, and people engaging with relevant social posts. | [website visitors](https://origami.chat/products/website-visitors), [X](https://r.jina.ai/https://x.com/origamichat) |
| 7. Enrich | Add any column (work email, direct phone, employee count, tech stack, funding, custom). CSV import is matched and enriched. Emails are SMTP-checked and come from a waterfall of 5 email providers and 9 phone providers. | [AI prospecting](https://origami.chat/products/ai-research-agents), [outbound](https://origami.chat/products/outbound), [pricing](https://origami.chat/pricing) |
| 8. Write and send | The **Sequencer** handles email and social, up to 10 steps per channel, with reply branches, local-time send windows, account rotation, daily caps, a pause when domain reputation trips, and one shared inbox. A reply pauses that lead's sequence. **Approval mode** holds every message for review, or you can let it auto-send. Done-for-you sending inboxes cost $4/mo. Voice-cloned voice notes are claimed to give "2.3x higher positive reply rate". | [sequencer](https://origami.chat/products/sequencer), [home](https://origami.chat/), [pricing](https://origami.chat/pricing), [X](https://r.jina.ai/https://x.com/origamichat) |
| 9. Content | "Viral content" / Content mode (Pro and up) finds outlier posts in your niche each week and rewrites them in your voice with brand-kit graphics for LinkedIn, X and Instagram, through an approval queue. | [viral content](https://origami.chat/products/viral-content), [pricing](https://origami.chat/pricing) |
| 10. Export / sync | Free CSV export and push to HubSpot or Salesforce. The CRM connection (Attio, Salesforce, HubSpot) is **read-only for dedup**, with an "already in CRM" column. There is an API v3 with async jobs, webhooks and a hosted **MCP server**. | [pricing](https://origami.chat/pricing), [CRM docs](https://origami.chat/docs/crm-integrations), [API docs](https://docs.origami.chat) |

**Inference:** the product is a chat agent sitting on top of one spreadsheet. Every feature is a column, a filter or an action on that table, which keeps a long feature list from feeling bloated.

### A3. How they claim to get results

| Claim | Source |
|---|---|
| "8 days" to a first positive reply (typical); "10 minutes" to live campaigns; "10+ hours saved weekly" | [home](https://origami.chat/) |
| "3–6x more positive replies than traditional outbound" | [YC](https://www.ycombinator.com/companies/origami-2) |
| CBRE (Reuben Torenberg, SVP): "CBRE booked meetings week 1, expanded…" | [home](https://origami.chat/) |
| Stellar (Matt Wetrich, CEO): "Stellar closed $200k ARR each month using Origami pre-researched leads" | [changelog page (sign-in redirect)](https://r.jina.ai/https://origami.chat/changelog) |
| Stellar grew its client base 8x in 9 months, partly credited to Origami; outbound closes "4x industry average"; Wetrich became an angel investor | [VentureBeat](https://venturebeat.com/ai/y-combinators-hottest-startup-origami-agents-secures-2m-seed-round-to-supercharge-sales-teams-with-ai/) |
| 203 Florida paving contractors found, 162 with verified phones, in about 5 minutes; a med-spa team built 300 qualified leads in week 1; an agency runs 15,000 leads a month through the API | [blog](https://origami.chat/blog/origami-lead-generation-2026) |
| Local: "32M+ local businesses in the US", "70% missing from traditional databases", Apollo returned 0 results for the example search | [local business](https://origami.chat/products/local-business) |
| "90%+ deliverability on verified addresses"; "<5 minutes from ICP to CRM-ready contacts" | [outbound](https://origami.chat/products/outbound) |

There are no formal case-study pages. The [use-cases page](https://origami.chat/use-cases) has no customer stories, and the [Product Hunt reviews page](https://www.producthunt.com/products/origami-chat/reviews) shows 0 reviews.

### A4. Pricing in detail

Current plans, monthly billing only ([pricing](https://origami.chat/pricing)):

| | **Starter** | **Pro** (recommended) | **Max** | **Enterprise** |
|---|---|---|---|---|
| Price | $99/mo | $199/mo | $399/mo | Custom (Calendly) |
| Included usage | **$165** | **$330** | **$660** | n/a |
| Top-up price | $22 for $22 | $20 for $22 | $18 for $22 | n/a |
| Projects | 3 | 10 | Unlimited | Unlimited |
| AI model | Origami 1.2 **Lite** | Origami 1.2 **Max** | 1.2 Max | n/a |
| Team members | Unlimited | Unlimited | Unlimited | Unlimited |
| Senders included | 5 email + 3 LinkedIn | 20 email + 3 LinkedIn | 50 email + 10 LinkedIn | n/a |
| Extra senders | $2/mo per email sender, $10/mo per LinkedIn sender | same | same | n/a |
| Done-for-you inbox | $4/mo | $3.60/mo | $3.20/mo | n/a |
| Content mode | No | Yes | Yes | n/a |
| Dedicated Slack channel | No | No | Yes | Yes, plus SSO/SCIM and SLA |
| Included on all paid plans | CSV export, email and phone contact info, unlimited Sequencer, auto top-up | | | |

**Credit model.** You pay for new leads, verified emails ($0.066 each, 5 providers tried in order), verified phones ($0.33 each, 9 providers), and tech, ads or traffic enrichments. Contact data is passed through "at cost with 0% markup", and you pay nothing when there is no match. Chatting with the agent, transforming your own data and exporting are always free. Each operation shows its cost before it runs. **Trial:** 7 days of Starter with $66 of usage, card required ([pricing](https://origami.chat/pricing)). YC founders get a permanent $29/mo price ([guide](https://origami.chat/guide)). Visitor identification costs $0.11 per company delivered ([website visitors](https://origami.chat/products/website-visitors)).

**How the pricing pushes upgrades**
- **Bonus usage that grows with the tier:** every tier includes about 1.67x its price in usage, and cheaper top-ups on higher tiers mean heavy users save by moving up.
- **A better model on higher tiers** (Lite on Starter, Max on Pro and up): output quality is the upgrade lever.
- **Project caps** (3, 10, unlimited) act as the agency and multi-market limit, instead of seats.
- **Unlimited seats** spread the product across a team, and the whole team draws down the shared balance.
- **Auto top-up** is on by default, with a limit you can set or turn off.
- **Bundled sequencer:** the page compares Smartlead, Instantly and Outreach at "$50 to $250 per seat per month" ([pricing](https://origami.chat/pricing)).

**Pricing history (evidence that they iterated):** an Origami blog post described a free plan with "1,000 credits, no credit card" and paid plans "from $29/month" ([blog](https://origami.chat/blog/origami-lead-generation-2026)). In March 2026 press reported "from USD $80 per month" ([CMOtech](https://cmotech.uk/story/origami-launches-chat-based-ai-tool-for-sales-leads)). Today it is $99 with a card-required trial ([pricing](https://origami.chat/pricing)). Pages also disagree with each other: the homepage shows Starter plus "Teams (custom)" ([home](https://origami.chat/)), and the sequencer page names Max, Ultra and Scale tiers ([sequencer](https://origami.chat/products/sequencer)). **Inference:** they moved from free to card-required and raised the entry price once demand was proven.

### A5. Integrations and data sources (the "all-in-one machine")

| Group | Named items | Source |
|---|---|---|
| **Email finding (waterfall, 5)** | Findymail, LeadMagic, Wiza, People Data Labs, Prospeo | [pricing](https://origami.chat/pricing) |
| **Phone finding (waterfall, 9)** | Bytemine, People Data Labs, LeadMagic, Wiza, Findymail, Forager, Prospeo, ContactOut, Zeliq | [pricing](https://origami.chat/pricing) |
| **Lead sources** | Google Maps, Google Business Profiles, state license registries and licensing boards, Yelp, business and state directories, LinkedIn, 100+ job boards, Shopify and WooCommerce stores, Crunchbase, BuiltWith and tech-stack databases, funding data, news, X, Instagram, YouTube, TikTok, Facebook, any public webpage (browser scraping) | [local](https://origami.chat/products/local-business), [outbound](https://origami.chat/products/outbound), [AI prospecting](https://origami.chat/products/ai-research-agents), [signals](https://origami.chat/products/signal-detection), [blog](https://origami.chat/blog/origami-lead-generation-2026), [web scraping](https://origami.chat/products/web-scraping), [guide](https://origami.chat/guide) |
| **Intent** | LinkedIn intent data ("30M+ real-time datapoints"); website visitors via PostHog | [X](https://r.jina.ai/https://x.com/origamichat), [website visitors](https://origami.chat/products/website-visitors) |
| **Infrastructure (Product Hunt "Built with")** | **Apify** ("Scrape any website or datasource imaginable"), **Supabase** ("Somewhere to store 10k+ rows of leads per user"), **Claude by Anthropic** ("Claude Opus 4.6 powers Origami") | [PH Built with](https://www.producthunt.com/products/origami-chat/built-with) |
| **CRM** | Salesforce, HubSpot (push and read-only dedup), Attio (dedup); former customers from Stripe or a CRM | [CRM docs](https://origami.chat/docs/crm-integrations), [AI prospecting](https://origami.chat/products/ai-research-agents), [X](https://r.jina.ai/https://x.com/origamichat) |
| **Outreach** | Own Sequencer (email and social), Gmail and Outlook mailboxes, LinkedIn senders, done-for-you inboxes, voice notes | [sequencer](https://origami.chat/products/sequencer), [pricing](https://origami.chat/pricing), [X](https://r.jina.ai/https://x.com/origamichat) |
| **Developer** | REST API v3, webhooks, hosted MCP server, an "Origami skill" for AI coding assistants | [API docs](https://docs.origami.chat) |
| **Other** | Slack (community and Max-plan channel), Calendly (sales booking), Stripe Connect (affiliate payouts) | [pricing](https://origami.chat/pricing), [partners](https://origami.chat/partners) |

**Inference:** Origami's moat is the orchestration, not the data. It resells commodity providers at cost, which also lets it say "0% markup", and earns its margin on the subscription and the AI work. A waterfall across providers raises match rates without exclusive data.

### A6. Growth and go-to-market

| Lever | Evidence |
|---|---|
| **YC halo + Launch YC** | YC Fall 2024. The launch post "Find who's looking" ([Launch YC](https://www.ycombinator.com/launches/MFd-origami-find-who-s-looking)). Founders called it the "fastest-growing startup" in its batch, with $50K MRR in an 8-week beta ([VentureBeat](https://venturebeat.com/ai/y-combinators-hottest-startup-origami-agents-secures-2m-seed-round-to-supercharge-sales-teams-with-ai/)). |
| **Product Hunt** | The launch was posted by Garry Tan ([PH forum](https://www.producthunt.com/p/origami-chat)). It was #1 Product of the Day on 2026-02-19 with 491 upvotes and 750 followers ([PH awards](https://www.producthunt.com/products/origami-chat/awards)). |
| **Organic launch wave** | "Organic growth in January and February 2026, with no paid marketing spend", "more than 1,000 signups in February", and unsolicited enterprise inquiries ([CMOtech](https://cmotech.uk/story/origami-launches-chat-based-ai-tool-for-sales-leads), company-reported). |
| **Frequent feature launches on X** | Voice cloning, intent data, "Origami v2… 6 AI workers", warm-lead targeting ([X](https://r.jina.ai/https://x.com/origamichat)). A secondary aggregator claims "5M impressions from ten feature launches" and $1M+ ARR ([arr.club](https://www.arr.club/origami-chat/origami-chat-surpasses-1m-arr-with-50-monthly-growth)). **Not verified from a first-party source.** |
| **Low-friction product promise** | "Enter your website" leads to campaigns in about 10 minutes ([home](https://origami.chat/)). A trial with $66 of usage ([pricing](https://origami.chat/pricing)). Earlier, a free plan ([blog](https://origami.chat/blog/origami-lead-generation-2026)). |
| **Programmatic SEO** | 134 `/for/<industry>` pages ([/for](https://origami.chat/for)), "origami-vs-<competitor>" comparison pages (9 on page 1) ([compare](https://origami.chat/compare)), `/flows/<buyer-list>` example pages ([flows](https://origami.chat/flows)), and 18 product pages ([home](https://origami.chat/)). **Inference:** these are templated pages aimed at long-tail "lead list for X" searches and at AI answer engines. Every page carries "summarize with ChatGPT, Perplexity or Claude" links. |
| **Authority content** | A very long founder-voiced outbound playbook ([guide](https://origami.chat/guide)), a "Modern GTM" page ([modern GTM](https://origami.chat/modern-gtm)), a YouTube channel under the founder's name and a Slack community ([home](https://origami.chat/)). |
| **Partner flywheel** | 15% of paid invoices for 6 months; bulk deals for VCs, accelerators and newsletters; a two-sided $11 usage referral ([partners](https://origami.chat/partners)). The YC $29/mo deal ([guide](https://origami.chat/guide)). |
| **Pricing as a growth lever** | No per-seat pricing, with team-shared usage ([pricing](https://origami.chat/pricing)). |
| **Dogfooding** | The playbook tells founders to send about 20 to 30 personalized emails a day themselves, and anchors outreach on "doing some of the work up front" ([guide](https://origami.chat/guide)). **Inference:** they sell Origami with Origami. The pinned X post sells "your first 50 customers" ([X](https://r.jina.ai/https://x.com/origamichat)). |

---

## Part B: Recommendations for OpenMarko

### B0. Where OpenMarko already stands relative to Origami

| Origami pattern | OpenMarko today | Gap |
|---|---|---|
| Prompt to lead table, local filters (rating, reviews, category) | Keyword + city or radius search, ease-of-sale score, filters for no-website, unclaimed, ads and agency | **Ahead** for local: rank #4–15, quick fixes and missed revenue are reasons to buy, not just firmographics |
| Contact waterfall | Owner, phone line type (Twilio), email with verification (ZeroBounce/Hunter), socials | About even. A second email source would help, see B2 |
| Plays / signals | Saved searches | No "why now" triggers yet (rank drop, new 1-star review, started ads, new listing) |
| Personalized writing | Pitch email on the audit page | Not tied to sending or tracking |
| Sequencer + inbox | None | **Missing link** |
| CRM push / dedup | None | Needed by agencies, not by the founder on day 1 |
| "Enter your website" free result | "Audit a business" flow (internal) | Not public as a lead magnet |
| Usage-based pricing with a cost shown before each run | Runs log already shows the cost of each run | Good base for credit pricing |

### B1. Feature suggestions (prioritized, with a bloat check)

**Rule:** build a feature only if it is a link in the loop **find, then audit, then send, then view, then reply or book, then pay, then deliver results, then case study**, or if a paying customer asks for it twice.

| Priority | Feature | Origami pattern / gap | Why it drives revenue | Bloat check |
|---|---|---|---|---|
| **Must** | **Public audit link** (`openmarko.com/a/<token>`): the existing sales audit as a hosted page with CTA buttons (book, start plan) | Origami's "do the work up front" offer ([guide](https://origami.chat/guide)) | The audit is the demo. A link in a short email beats a PDF attachment for deliverability. **Inference**, consistent with the guide's "plain, light on links" advice. | Reuses the existing page. Low |
| **Must** | **View tracking**: first view, number of views, sections scrolled, notification ("Joe's HVAC opened the audit 3x") | Origami's visitor-intent / "find who's looking" theme ([Launch YC](https://www.ycombinator.com/launches/MFd-origami-find-who-s-looking)) | Tells you whom to call today, which is the highest-intent signal you will have | One table plus a pixel. Low |
| **Must** | **Pipeline status per prospect** (New, Sent, Viewed, Replied, Booked, Won, Lost) plus notes | Origami's "already in CRM" dedup column ([CRM docs](https://origami.chat/docs/crm-integrations)) | Without it you double-email people and lose follow-ups | A column, not a CRM. Low |
| **Must** | **Send from your own mailbox** (Gmail/Outlook OAuth), 1 email plus 2–3 follow-ups that stop on reply, with a send cap of about 30 a day | Sequencer with reply-pause ([sequencer](https://origami.chat/products/sequencer)) and the 20–30/day guidance ([guide](https://origami.chat/guide)) | Closes the loop inside the product. You use it yourself, and agencies will pay for it | **Medium.** Alternative for weeks 1–4: a "Push to Instantly/Smartlead" CSV or API (B2) and build later |
| **Must** | **Booking link + Stripe checkout on the audit page**, then "Convert prospect to workspace" so the audit's game plan becomes the new customer's To-do | No direct Origami equivalent. It sells through Calendly ([pricing](https://origami.chat/pricing)) | Removes the step between "yes" and paying. Continuity from audit to onboarding is a unique advantage | Cal.com embed + Stripe Payment Links. Low |
| **Must** | **Compliance basics**: unsubscribe footer, physical address, suppression list | n/a (CAN-SPAM; not researched here, verify) | Protects domain reputation, which protects revenue | Low |
| **Should** | **Approval mode / AI first line**: generate a personalized email from audit facts (rank, top competitor, review gap, missed revenue) and hold it for approval | Approval mode ([home](https://origami.chat/)) | Personalization grounded in real signals is what the playbook recommends ([guide](https://origami.chat/guide)) | Extends the existing pitch email. Low |
| **Should** | **Local "plays" / triggers** on saved searches: rank dropped out of the top 3, new 1–2★ review, started Google Ads, new GBP listing, unclaimed profile, website down | Plays and buying signals ([home](https://origami.chat/), [signals](https://origami.chat/products/signal-detection)) | Gives a "why now" reason. Re-scans are cheap with DataForSEO | Medium. Reuses existing scans |
| **Should** | **Public free-audit lead magnet** on the marketing site ("Enter your business and see your map-pack grid vs. top 3"), with email capture, rate-limited | "Enter your website" onboarding ([home](https://origami.chat/)) | Inbound pipeline from the same engine. Also a strong Product Hunt demo | Low. Cap scan cost |
| **Should** | **Monthly results email** for customers (rank movement, calls and direction requests from GBP) that becomes the case study | Origami's metric-led social proof ([home](https://origami.chat/)) | Reduces churn and produces case studies automatically | Reports already exist. Low |
| **Should** | **White-label audits for agencies** (logo, colors, custom domain, sender) | Origami's agency segment ([use cases](https://origami.chat/use-cases)), Smartlead's white-label add-on ([Smartlead](https://www.smartlead.ai/pricing)) | Agencies pay more and stay longer. Each agency multiplies prospects (part b of the founder's goal) | Medium. Do after 3 agencies ask |
| **Should** | **Affiliate / referral** (for example 20% for 6–12 months for agencies and consultants) | 15%/6 months plus a two-sided referral ([partners](https://origami.chat/partners)) | Cheap distribution | Use Stripe or an off-the-shelf affiliate tool. Low |
| **Later** | CRM sync (HubSpot, GoHighLevel) for agencies | Origami's CRM docs ([CRM docs](https://origami.chat/docs/crm-integrations)) | Agencies live in GHL (sub-accounts, SaaS mode; see [GHL pricing](https://www.gohighlevel.com/pricing)) | Webhook or Zapier first |
| **Later** | LinkedIn / SMS / voice-note steps, done-for-you inboxes | Origami's sequencer and senders ([pricing](https://origami.chat/pricing)) | Marginal for local owners, who mostly respond to phone and email (**Inference**) | **High bloat.** Skip |
| **Later** | Programmatic `/for/<niche>-<city>` pages built from real anonymized scan data | 134 `/for` pages ([/for](https://origami.chat/for)) | Long-tail SEO. Fits a local-SEO brand | Marketing site, not product |
| **Later** | Public API / MCP | API v3 + MCP ([API docs](https://docs.origami.chat)) | Agencies and power users | Not before product-market fit |
| **Skip** | Content mode for social, B2B website-visitor ID, B2B people search | Origami's B2B features | Off-ICP for local SEO | Bloat |

### B2. Data-enrichment and stack integrations

Prices were read from each vendor's own page on 2026-10-30. "Unverified" means I could not confirm the price on a first-party page.

| Vendor | What it provides | Price (first-party) | Where it fits in OpenMarko | Verdict |
|---|---|---|---|---|
| **DataForSEO Business Listings** | Google Maps-derived POI search by keyword, category and location; up to 1,000 items per request | $0.012 per request + $0.00036 per item (1,000 items = $0.372) ([DataForSEO](https://dataforseo.com/pricing/business-data/business-listings)) | Already used for the no-website search; bulk niche × city sweeps | **Keep (core)** |
| **Apify Google Maps Scraper** (compass/crawler-google-places) | Places, reviews and images; website emails and socials; Impressum owner names in DE/AT/CH; people leads (name, title, work email, phone, LinkedIn); email verification; social profile stats | From $1.50 per 1,000 places; add-ons such as contacts $0.20/100 (Free) or $0.15/100 (Silver), social profiles $10/100 (Free) or $0.70/100 (Silver) ([Apify](https://apify.com/compass/crawler-google-places)) | A **second enrichment source** for emails and socials from websites, and for owner names. The same vendor Origami lists ([PH](https://www.producthunt.com/products/origami-chat/built-with)) | **Should**, as a fallback in a waterfall |
| **Hunter** | Domain search, email finder, verifier | Free 50 credits; Starter $49/mo (2,000 credits); Growth $149 (10,000); Scale $299 (25,000); 30% off yearly; 1 credit per find, 0.5 per verify ([Hunter](https://hunter.io/pricing)) | Email step 2 in the waterfall | Keep |
| **ZeroBounce** | Email validation | Pay as you go from $39 for 2,000; ONE plan $99/mo; free 100/mo; Email Finder 20 credits per hit ([ZeroBounce](https://www.zerobounce.net/email-validation-pricing)) | Final verify before sending (bounces under 2%) | Keep |
| **Twilio Lookup** | Line type (mobile/landline/VoIP), CNAM caller name, line status, reassigned-number risk | Line type $0.008; CNAM $0.01; identity match $0.10; formatting free ([Twilio](https://www.twilio.com/en-us/user-authentication-identity/pricing/lookup)) | Already used. **Add CNAM** ($0.01) as a cheap owner-name hint for small businesses | Keep, add CNAM |
| **Origami's waterfall providers** (Findymail, LeadMagic, Prospeo, Wiza, PDL, ContactOut, Forager, Bytemine, Zeliq) | Work email and mobile | Origami charges users $0.066 per email and $0.33 per phone at cost ([Origami pricing](https://origami.chat/pricing)). Vendor prices **unverified** | Benchmark for your cost per contact. Mostly B2B/LinkedIn-centric, so weaker for owner-operators (**Inference**) | Later, if owner match rates are low |
| **Apollo** | B2B people and company database, sequencing | Plan prices **not shown** on the page; API on Custom plans ([Apollo](https://www.apollo.io/pricing)) | Weak for local trades according to Origami ("0 results from Apollo") ([local](https://origami.chat/products/local-business)) | Skip for now |
| **State license registries / Secretary of State filings; OpenCorporates** | Owner and officer names, license status, incorporation date | OpenCorporates offers open data (share-alike) or commercial terms; pricing **unverified** ([OpenCorporates API](https://api.opencorporates.com/)) | Owner name and "new business" trigger. Origami uses license registries for trades ([local](https://origami.chat/products/local-business)) | Should, for trades niches (scrape per state) |
| **BuiltWith** | Tech-stack lookups, lead lists by technology | $295 / $495 / $995 per month ([BuiltWith](https://builtwith.com/plans)) | Detect WordPress (one-click fixes), Wix/Squarespace, call tracking, chat widgets | Too expensive early |
| **Wappalyzer** | Tech detection API | Free 50 lookups a month; Pro $250/mo (5,000 credits); Business $450 ([Wappalyzer](https://www.wappalyzer.com/pricing/)) | Same as above | **Inference:** detect CMS yourself during the existing On-Page crawl (generator meta tags, `/wp-json`) for free |
| **Meta Ad Library** | Whether a business runs Facebook/Instagram ads | **Unverified**: the API page returned 403 | "Runs ads" score and a "they already spend on marketing" signal | Later |
| **Google Ads Transparency Center** | Advertiser ads by domain | **Unverified**: FAQ not readable; no official API confirmed | Same | Later. DataForSEO Labs / Domain Analytics paid-traffic data may already cover this |
| **Yelp / Facebook pages** | Reviews, extra contact info | **Not checked** | Contact fallback (the mock already labels some emails "Facebook page") | Through Apify actors, later |
| **Instantly** | Cold email sending, warmup, lead DB | Growth $47/mo (5,000 emails, 1,000 contacts); Hypergrowth $97; Light Speed $358 ([Instantly](https://instantly.ai/pricing)) | **Weeks 1–4 shortcut:** push audit-link leads to Instantly instead of building a sequencer | Should (stopgap) |
| **Smartlead** | Cold email; client workspaces and white-label ($29 per client workspace) | Base $39; Pro $94; Unlimited Smart $174; Prime $379 ([Smartlead](https://www.smartlead.ai/pricing)) | Agency-friendly alternative | Option |
| **lemlist** | Email + LinkedIn + calls + SMS | Email $69/user; Multichannel $109/user ([lemlist](https://www.lemlist.com/pricing)) | Only if multichannel matters | Skip |
| **GoHighLevel** | Agency CRM, sub-accounts, SaaS mode, white label | Starter $97; Unlimited $297; Founder/Pro $497 ([GHL](https://www.gohighlevel.com/pricing)) | Where many local-marketing agencies run clients (**Inference**). Push won deals and audits as GHL contacts | Later (agency tier) |
| **HubSpot** | CRM | **Not checked** (Origami's guide cites a HubSpot free tier ([guide](https://origami.chat/guide))) | Agency CRM sync | Later |
| **Cal.com** | Booking, embed, webhooks | Free (1 user); Teams $12/user/mo yearly ([Cal.com](https://cal.com/pricing)) | Embed on the audit page; webhook sets status to Booked | **Must** (free tier) |
| **Calendly** | Booking | Free (1 event type); Standard $10/seat; webhooks from Standard ([Calendly](https://calendly.com/pricing)) | Alternative | Option |
| **Stripe** | Checkout, Payment Links, Billing | 2.9% + 30¢ per US card; Billing 0.7%; Checkout and Payment Links at no extra charge ([Stripe](https://stripe.com/pricing)) | Pay from the audit page; usage top-ups | **Must** |
| **PostHog** | Product analytics; Origami reads it for visitor ID ([Origami](https://origami.chat/products/website-visitors)) | **Not checked** | Track audit-page views and the funnel | Optional (a simple event table is enough) |

**Suggested contact waterfall** (cheapest first, stop on the first verified hit): website and contact-page scrape (On-Page crawl you already run), then Apify contacts enrichment, then Hunter Domain Search / Email Finder, then ZeroBounce verify. Phone: GBP phone, then Twilio Line Type + CNAM. Owner name: Twilio CNAM, then the state license or SoS registry, then the website About page. Show the cost before each run, as Origami does ([pricing](https://origami.chat/pricing)) and as the Runs log already does.

### B3. "No bloat, sell fast": honest assessment and 30/60/90 plan

**Assessment.** OpenMarko is still a clickable mock (see `ui-mock/README.md`). The selling loop needs a **real backend for exactly three things**: prospect search and enrichment, the hosted audit page, and enough of the customer product (geo-grid scans, GBP connection, To-do, reports) to deliver results after someone pays. Do **not** build LinkedIn steps, a sequencer UI beyond 3 steps, white-label, CRM sync or content tools before you have 10 paying customers. Origami's own playbook says early outbound is for learning, done personally at 20–30 emails a day ([guide](https://origami.chat/guide)). Origami had a sequencer, approval mode and Content mode only after reaching scale.

**Pick a beachhead.** One niche × one metro, for example **HVAC or plumbing in Austin**. Reasons: high job value, so missed revenue is believable; map pack dependent; many owner-operators; your mock already has Austin-area coordinates. Origami lists 30 home-services verticals first in its vertical index ([/for](https://origami.chat/for)), which suggests strong demand from people selling into those trades (**Inference**). A dental practice is the alternative niche.

**Pricing suggestion, informed by Origami** (a hypothesis to test, not validated):

| Plan | Price | Includes | Origami pattern |
|---|---|---|---|
| **Local** (one business) | $99/mo | 1 location, monthly 7×7 grid on 5 keywords, To-do with autopilot, GBP posts and review replies, monthly report | Same $99 entry anchor ([pricing](https://origami.chat/pricing)) |
| **Pro / Agency** | $299/mo | 10 locations, white-label reports, prospecting + audits + sending, **usage credits worth more than the fee** (for example $450 of scans and enrichment) | Bonus usage + project caps instead of seats |
| **Agency Max** | $599/mo | 30 locations, cheaper top-ups, a Slack channel | Tiered top-up discount, dedicated Slack |
| Top-ups | At or near cost | Extra grid scans and contacts; cost shown before each run | "0% markup" contact data |

Keep **unlimited seats**. Offer a **7-day trial with a card**, or "first month $1 if we don't move you in the map pack" for SMBs. Cost-to-serve per scan depends on DataForSEO SERP/maps pricing, which I did not verify here, so check margins in the Runs log before you fix scan allowances.

**30/60/90 playbook**

| Window | Do | Minimum features required | Targets |
|---|---|---|---|
| **Days 1–30: prove the loop by hand** | Run Prospecting for "HVAC" in Austin plus 3 suburbs. Filter to rank #4–15, rating 4.0 or higher, no agency, verified email. Pick the top 150. Send 20–30 **founder-written** emails a day: under 80 words, one pain, a yes/no ask, the audit link ("You're #7 for 'AC repair' in Round Rock; here's the 49-point map and the three fixes that got [competitor] to #1. Want the full plan?"). Follow up 3 times. Call everyone who views the audit twice or more. Do the first 3–5 customers' fixes **for** them (white-glove) | Hosted audit link + view tracking, pipeline status, Cal.com link, Stripe Payment Link. Send from Gmail manually or with Instantly ($47). Real backend for search, enrichment and audit | 600 sends, bounce under 2%, audit view rate 40% or more (assumption to test), 15 replies, 8 calls, **3–5 paying** |
| **Days 31–60: make it repeatable** | Build in-app sending (3 steps, stop on reply, ~30/day cap) and AI first lines from audit facts with approval. Add triggers on the saved search (rank drop, new bad review). Expand to a second suburb set or a second niche. Launch the public free-audit page. Collect before and after grids for every customer | In-app mailbox send, "Convert prospect to workspace", monthly results email | 1,200 sends, **10–20 paying locations**, first 2 measurable rank wins |
| **Days 61–90: turn results into distribution** | Publish 2 case studies (grid before and after, calls from GBP). Pitch **agencies** with "use OpenMarko to sign local clients": find them with the same prospecting tool (keyword "marketing agency"), and show your own funnel numbers as proof. Launch the affiliate program (20%). Launch on Product Hunt and as a Show HN with the free audit as the demo. Start `/for/<niche>` pages | Branded audits (logo/colors), basic agency workspace (multi-location) | **$3–5K MRR**, 2–3 agencies, churn under 5%/mo |

**Channels, in order:** (1) founder cold email with audit links; (2) phone follow-up on audit viewers; (3) the free-audit lead magnet with SEO pages; (4) agency partners and affiliates; (5) launch events (Product Hunt, communities). Origami's evidence for 4–5 is in A6.

**Metrics to track** (most come from the Runs log and pipeline):
- Funnel: sends per day, bounce rate (under 2%), audit view rate, views per viewer, positive reply rate, booked rate, close rate, days from first send to paid.
- Unit economics: data cost per prospect, cost per audit, cost per paying customer, plan margin after scans.
- Customer results: map-pack coverage change at 30 and 60 days, GBP calls and direction requests versus the previous 28 days, To-do items applied.
- Retention: logo churn, net MRR, percentage of customers with a case-study-grade win.

**Minimum end-to-end feature set, and nothing else:**
1. Real prospect search + waterfall enrichment + verification (backend)
2. Hosted audit page per prospect, with a tokenized link and a CTA
3. View tracking with a notification
4. Pipeline status with a suppression and unsubscribe list
5. Sending: Instantly push (weeks 1–4), then a 3-step mailbox sequence
6. Cal.com embed and webhook
7. Stripe Checkout and webhook that creates the workspace from the audit
8. Delivery: real grid scans, GBP connection, To-do, monthly report

---

## Sources

**Origami (first-party)**
- https://origami.chat/
- https://origami.chat/pricing
- https://r.jina.ai/https://origami.chat/pricing (proxy, for links)
- https://origami.chat/products/ai-research-agents
- https://origami.chat/products/local-business
- https://origami.chat/products/website-visitors
- https://origami.chat/products/sequencer
- https://origami.chat/products/outbound
- https://origami.chat/products/signal-detection
- https://origami.chat/products/viral-content
- https://origami.chat/products/web-scraping
- https://origami.chat/use-cases
- https://origami.chat/flows
- https://origami.chat/for
- https://origami.chat/compare
- https://origami.chat/guide
- https://origami.chat/modern-gtm
- https://origami.chat/partners
- https://origami.chat/company
- https://origami.chat/careers
- https://origami.chat/docs/crm-integrations
- https://origami.chat/blog/origami-lead-generation-2026
- https://r.jina.ai/https://origami.chat/changelog (redirected to sign-in; shows the Stellar quote only)
- https://docs.origami.chat
- https://r.jina.ai/https://x.com/origamichat (company X account, read through a proxy)

**YC / Product Hunt**
- https://www.ycombinator.com/companies/origami-2
- https://www.ycombinator.com/launches/MFd-origami-find-who-s-looking
- https://www.producthunt.com/products/origami-chat/awards
- https://www.producthunt.com/products/origami-chat/built-with
- https://www.producthunt.com/products/origami-chat/launches/origami-chat
- https://www.producthunt.com/products/origami-chat/reviews
- https://www.producthunt.com/products/origami-chat/makers
- https://www.producthunt.com/p/origami-chat

**Press (secondary, used for founder quotes and company-reported metrics)**
- https://venturebeat.com/ai/y-combinators-hottest-startup-origami-agents-secures-2m-seed-round-to-supercharge-sales-teams-with-ai/
- https://cmotech.uk/story/origami-launches-chat-based-ai-tool-for-sales-leads
- https://www.arr.club/origami-chat/origami-chat-surpasses-1m-arr-with-50-monthly-growth (aggregator; not verified)

**Vendors**
- https://dataforseo.com/pricing/business-data/business-listings
- https://apify.com/compass/crawler-google-places
- https://hunter.io/pricing
- https://www.zerobounce.net/email-validation-pricing
- https://www.twilio.com/en-us/user-authentication-identity/pricing/lookup
- https://www.apollo.io/pricing
- https://builtwith.com/plans
- https://www.wappalyzer.com/pricing/
- https://api.opencorporates.com/
- https://instantly.ai/pricing
- https://www.smartlead.ai/pricing
- https://www.lemlist.com/pricing
- https://www.gohighlevel.com/pricing
- https://cal.com/pricing
- https://calendly.com/pricing
- https://stripe.com/pricing

## Couldn't verify / couldn't access

- **Origami changelog**: `/changelog` returns empty (JS), and the proxy redirects to sign-in. No release history was captured.
- **Product Hunt maker first comment and comments**: not present in the fetched pages. The "Built with" entries are featured comment excerpts, and the page doesn't say who wrote them. The PH makers page lists only Finn Mallery.
- **Founder personal X/LinkedIn posts**: not read. Only the company X account was read, through a proxy and without dates. A LinkedIn post reportedly claiming "5000+ companies" appeared in search results but was not opened.
- **YouTube (@finnmallery)**: the page returned no channel content.
- **Customer count**: 10,000+ (YC profile), 2,000+ (homepage) and 1,000+ (X bio) conflict. None is independently verified.
- **ARR**: "$1M+ ARR, 50% monthly growth" comes only from arr.club, a secondary aggregator. Not confirmed first-party.
- **Origami guide**: characters 100k–200k of the ~290k-character page were not read, so the middle sections may hold more founder growth details.
- **/compare page 2, individual `/for/*` and `/flows/*` pages**: not read. Programmatic generation is inferred from URL patterns.
- **CMOtech press piece**: lists Rahul Chandler as CTO and Kenson Chung as President, but YC lists Kenson Chung as CTO. Titles may have changed.
- **Apollo** plan prices (not on the page), **OpenCorporates** pricing, **Meta Ad Library API** (403), **Google Ads Transparency** (FAQ not readable; no API confirmed), the **DataForSEO GMB API** page (404), and **HubSpot, Yelp Fusion, PostHog** pricing (not checked).
- **Origami's email and phone waterfall vendors' own prices**: not checked.
- All OpenMarko targets (view rate, close counts, MRR) and pricing are **hypotheses** to test, not benchmarks.

export type VisualKey = "grid" | "fixes" | "profile" | "reviews" | "ai" | "prospects";

export type Service = {
  slug: string;
  name: string;
  short: string;
  tag: string;
  title: string;
  titleMuted: string;
  sub: string;
  visual: VisualKey;
  benefits: { title: string; body: string }[];
  steps: { title: string; body: string }[];
  faqs: { q: string; a: string }[];
  caseStudy: string;
  audience: "owners" | "agencies";
};

export const services: Service[] = [
  {
    slug: "map-pack-tracking",
    name: "Map pack tracking",
    short: "See where you rank from 49 spots around your business, and who beats you at each one.",
    tag: "Geo-grid",
    title: "See the map the way",
    titleMuted: "your customers do",
    sub: "Ranking #3 from your front door means little if you're #14 two miles away. OpenMarko searches Google Maps from a grid of points around you, every week, for every keyword.",
    visual: "grid",
    benefits: [
      { title: "Every competitor, at every point", body: "Each scan records the full top 20 at each pin, so you see exactly who outranks you and where. Competitor maps cost nothing extra." },
      { title: "Weekly, not whenever you remember", body: "Scans run on a schedule, so a drop shows up as a trend line and an alert, not as a quiet month of fewer calls." },
      { title: "Real numbers you can check", body: "Every scan shows when it ran, how many points it covered and what it cost. No black-box visibility scores." },
    ],
    steps: [
      { title: "Pick your keywords", body: "We suggest the searches that bring paying customers, with monthly volume for each." },
      { title: "Set your service area", body: "Choose the grid size and radius that match how far customers will drive." },
      { title: "Watch it move", body: "Weekly grids, before and after views, and an alert when a competitor overtakes you." },
    ],
    faqs: [
      { q: "How accurate are geo-grid scans?", a: "Each point is a real Google Maps search from that location. Results vary a little by device and time of day, so we show trends across weeks rather than a single number." },
      { q: "How many keywords can I track?", a: "Ten on the Local plan, with more available as top-ups at close to cost." },
    ],
    caseStudy: "carter-plumbing",
    audience: "owners",
  },
  {
    slug: "site-fixes",
    name: "Site audit & one-click fixes",
    short: "Find what's wrong on your website and fix it from the To-do list, without a developer.",
    tag: "Website",
    title: "Your website, fixed",
    titleMuted: "not just audited",
    sub: "Most audits hand you a PDF of problems. OpenMarko connects to WordPress and applies the fixes for you: schema, titles, local pages and speed, each with a revision you can roll back.",
    visual: "fixes",
    benefits: [
      { title: "Fixes, not findings", body: "Missing LocalBusiness schema, weak titles and thin service pages become buttons in your To-do list. Click Apply, and it's done." },
      { title: "Ranked by what moves rankings", body: "Issues are ordered by their effect on the keywords you track, so the first fix is the one worth doing first." },
      { title: "Safe to say yes", body: "Every change saves a revision in WordPress. Roll back in one click if you don't like it." },
    ],
    steps: [
      { title: "Crawl", body: "We crawl up to 100 pages and run a mobile speed test on your key pages." },
      { title: "Rank the issues", body: "Each issue is tied to the keywords it affects and how much it matters." },
      { title: "Apply", body: "Approve a fix and it ships through your connected WordPress site." },
    ],
    faqs: [
      { q: "What if my site isn't on WordPress?", a: "You still get the full audit with step-by-step instructions. One-click fixes need WordPress today." },
      { q: "Will this break my site?", a: "Fixes are small and reversible. Each one saves a revision, and nothing ships until you approve it." },
    ],
    caseStudy: "maple-main-dental",
    audience: "owners",
  },
  {
    slug: "business-profile",
    name: "Google Business Profile autopilot",
    short: "Posts, categories, photos and hours kept fresh, drafted by AI and approved by you.",
    tag: "Profile",
    title: "A profile Google",
    titleMuted: "wants to show",
    sub: "Google rewards profiles that are complete, active and relevant. OpenMarko compares yours with the businesses above you, then keeps it that way with weekly posts and the fixes the leaders already made.",
    visual: "profile",
    benefits: [
      { title: "Copy what the leaders did", body: "See the categories, services and attributes the top 3 use that you don't, and add them in one click." },
      { title: "Weekly posts, written for you", body: "Posts drafted from your services and season, scheduled once you approve them, with a check that each one actually went live." },
      { title: "Calls and directions, tracked", body: "See calls, direction requests and website clicks from Google, compared with the 28 days before." },
    ],
    steps: [
      { title: "Connect", body: "Sign in with Google. We read your profile and your competitors' public profiles." },
      { title: "Close the gaps", body: "Missing categories, services and photos appear in your To-do, ranked by impact." },
      { title: "Stay active", body: "Turn on autopilot for posts, or approve each one from your inbox." },
    ],
    faqs: [
      { q: "Can I edit posts before they go out?", a: "Yes. Every draft waits for approval unless you turn on autopilot for posts." },
      { q: "Do you manage multiple locations?", a: "Yes. Each location gets its own grid, To-do and report." },
    ],
    caseStudy: "round-rock-air",
    audience: "owners",
  },
  {
    slug: "reviews",
    name: "Review replies",
    short: "Personal, same-day replies to every review, drafted in your voice.",
    tag: "Reviews",
    title: "Answer every review",
    titleMuted: "the same day",
    sub: "Customers notice when a business replies, and they notice when a reply is a template. OpenMarko drafts a personal reply to each review within minutes, in your voice, for you to approve or auto-send.",
    visual: "reviews",
    benefits: [
      { title: "Personal, not templated", body: "Each draft mentions what the customer actually said: the technician's name, the job, the problem." },
      { title: "Fast on the hard ones", body: "Negative reviews are flagged straight away, with a calm draft and a reminder to follow up offline." },
      { title: "More reviews, the right way", body: "Ask every customer for a review with a simple link. No filtering out unhappy customers, which keeps you within the FTC rules." },
    ],
    steps: [
      { title: "A review comes in", body: "We see it within minutes of it appearing on Google." },
      { title: "A reply is drafted", body: "In your voice, using what the customer wrote." },
      { title: "You approve, or it sends", body: "Approve from your phone, or let 4 and 5-star replies go out automatically." },
    ],
    faqs: [
      { q: "Can replies go out automatically?", a: "Yes, and you choose which: for example 4 and 5-star reviews only, with negative ones always held for you." },
      { q: "Which review sites do you support?", a: "Google today, since it drives the map pack." },
    ],
    caseStudy: "maple-main-dental",
    audience: "owners",
  },
  {
    slug: "ai-visibility",
    name: "AI search visibility",
    short: "See whether ChatGPT, Gemini and Google's AI answers recommend you.",
    tag: "AI search",
    title: "Get recommended by AI",
    titleMuted: "not just ranked by Google",
    sub: "More and more people ask an AI assistant who to call. OpenMarko checks whether AI answers mention you for the same keywords you track, and shows which sources they trust.",
    visual: "ai",
    benefits: [
      { title: "One keyword list, every engine", body: "The keywords you track on the map are checked in AI answers too, so you see both in one place." },
      { title: "See who gets named instead", body: "When an AI answer recommends a competitor, we show which sites it pulled that from." },
      { title: "Fixes that help both", body: "Clear service pages, schema and consistent listings help AI answers and the map pack alike. They land in the same To-do." },
    ],
    steps: [
      { title: "Ask like a customer", body: "We run your keywords as natural questions, for example 'who's the best emergency plumber near me?'" },
      { title: "Record the answer", body: "Who was named, in what order, and which sources were cited." },
      { title: "Close the gap", body: "Missing citations and weak pages become To-do items." },
    ],
    faqs: [
      { q: "Which AI engines do you check?", a: "Google AI Overviews and AI Mode, ChatGPT, Gemini and Perplexity." },
      { q: "Is AI visibility measured the same way as rankings?", a: "Not yet. There's no standard, so we show what each answer actually said rather than a single score." },
    ],
    caseStudy: "maple-main-dental",
    audience: "owners",
  },
  {
    slug: "agency-prospecting",
    name: "Prospecting & sales audits",
    short: "Find businesses losing the map pack, send them proof, and sign them as clients.",
    tag: "For agencies",
    title: "Find clients who need you",
    titleMuted: "and show them why",
    sub: "Search a keyword and a radius. OpenMarko finds every business in the map pack, scores how easy each one is to sell, finds the owner's contact details, and builds a shareable audit with their missed revenue.",
    visual: "prospects",
    benefits: [
      { title: "Ease-of-sale scores", body: "Businesses ranked #4 to #15 with good ratings and easy fixes rise to the top. Those already in the top 3, or with an agency, sink." },
      { title: "An audit that sells for you", body: "A hosted page with their grid, the competitors beating them, missed revenue and a game plan. You see when they open it." },
      { title: "The audit becomes the work", body: "When they sign, the audit's game plan becomes their To-do. No re-onboarding, no blank dashboard." },
    ],
    steps: [
      { title: "Search", body: "A keyword and a city or radius, for example 'HVAC within 10 miles of Round Rock'." },
      { title: "Send the audit", body: "Share a link, not a PDF. See who opened it and how many times." },
      { title: "Sign and deliver", body: "Convert the prospect into a client workspace with the plan already loaded." },
    ],
    faqs: [
      { q: "Where do the contact details come from?", a: "The business's own website and profile first, then verified email and phone lookups. Each lookup shows its cost before it runs." },
      { q: "Can I put my own brand on audits?", a: "Client reports are white-label on the Agency plans. White-label audits are next on the roadmap." },
    ],
    caseStudy: "bright-pine-digital",
    audience: "agencies",
  },
];

export const serviceBySlug = (slug: string) => services.find((s) => s.slug === slug);

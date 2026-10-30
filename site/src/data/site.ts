/**
 * Site-wide content. Pricing and the offer follow the hypotheses in
 * docs/research/origami-and-openmarko-gtm.md and the competitor report; confirm before launch.
 */

/**
 * OpenMarko has no customers yet, so every case study and testimonial is a sample
 * built from the fictional businesses in the product mock. While this is true the
 * site labels them "Sample story". Replace them with real, consented stories and
 * set this to false. Publishing invented testimonials as real breaks the FTC rule
 * on fake reviews.
 */
export const SAMPLE_CONTENT = true;

export const APP_URL = "https://app.openmarko.com";

export type Plan = {
  id: string;
  name: string;
  price: number;
  cadence: string;
  for: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

export const plans: Plan[] = [
  {
    id: "local",
    name: "Local",
    price: 99,
    cadence: "/mo",
    for: "One business that wants more calls from Google.",
    features: [
      "1 location, 10 tracked keywords",
      "Weekly 7×7 map scans with competitor grids",
      "To-do list with one-click fixes",
      "Review replies and Google posts drafted for you",
      "AI search visibility on the same keywords",
      "Monthly results report",
    ],
    cta: "Start with a free audit",
  },
  {
    id: "agency",
    name: "Agency",
    price: 299,
    cadence: "/mo",
    for: "Agencies and freelancers with up to 10 clients.",
    features: [
      "10 client locations, $15 per extra location",
      "Everything in Local, for every client",
      "Prospecting by keyword and radius, with ease-of-sale scores",
      "Shareable sales audits with view tracking",
      "White-label client reports",
      "Usage credits worth more than the plan fee",
    ],
    cta: "Start a 7-day trial",
    featured: true,
  },
  {
    id: "agency-max",
    name: "Agency Max",
    price: 599,
    cadence: "/mo",
    for: "Growing agencies with up to 30 clients.",
    features: [
      "30 client locations",
      "Everything in Agency",
      "Cheaper top-ups for scans and contacts",
      "Shared Slack channel with the team",
      "Priority scan queue",
    ],
    cta: "Talk to us",
  },
];

/** The offer stack. Each line is a commitment: confirm every one before launch. */
export const offer = {
  name: "The Map Pack Promise",
  headline: "Move up in 60 days, or you don't pay for them.",
  sub: "We take the risk, because the audit already shows us what's holding you back.",
  items: [
    { title: "A free audit, before you pay anything", body: "See your 49-point map grid, who outranks you at each point, and the fixes that close the gap. No card needed." },
    { title: "We do your first five fixes for you", body: "Categories, schema, photos, posts, whatever your audit ranks highest. Done by us and approved by you, in your first week." },
    { title: "60-day map pack guarantee", body: "If your main keyword hasn't moved up in the map pack after 60 days, we refund both months. Just ask." },
    { title: "No contracts, ever", body: "Month-to-month. Cancel in two clicks. Your data and reports export with you." },
    { title: "See what every scan costs", body: "Each scan shows its real data cost. Credits never expire, and top-ups are close to cost." },
  ],
};

/** Market facts shown in the stats strip. Each carries its source. */
export const stats = [
  { value: "45%", label: "of consumers used AI tools to find local businesses in 2026, up from 6% a year earlier", source: "BrightLocal Local Consumer Review Survey 2026", url: "https://www.brightlocal.com/research/local-consumer-review-survey/" },
  { value: "19%", label: "of consumers expect a reply to their review the same day, up from 6%", source: "BrightLocal Local Consumer Review Survey 2026", url: "https://www.brightlocal.com/research/local-consumer-review-survey/" },
  { value: "74%", label: "of consumers only consider reviews from the last three months", source: "BrightLocal Local Consumer Review Survey 2026", url: "https://www.brightlocal.com/research/local-consumer-review-survey/" },
  { value: "$1.26", label: "is the raw data cost of tracking 10 keywords weekly. Some tools charge up to 80× that. We show you the receipt.", source: "Public map-search API pricing, OpenMarko research, Oct 2026" },
];

export const industries = ["HVAC", "Plumbing", "Roofing", "Dental", "Med spas", "Law firms", "Auto repair", "Electricians", "Landscaping", "Veterinary", "Chiropractic", "Pest control"];

export const faqs = [
  { q: "What is the map pack, and why does it matter?", a: "It's the box of three businesses Google shows with a map when someone searches for a service near them. Most calls from Google go to those three. If you're #4 or lower, you're mostly invisible on a phone." },
  { q: "How is OpenMarko different from a rank tracker?", a: "A rank tracker tells you where you stand. OpenMarko also shows why the businesses above you rank, then turns that into a To-do list it can do for you, from Google posts and review replies to fixes on your website." },
  { q: "Do you change anything without asking?", a: "No. Everything starts read-only. You approve each change, or turn on autopilot for the kinds of changes you trust, like posting and review replies. Website fixes keep a revision you can roll back." },
  { q: "What do I need to connect?", a: "Your Google Business Profile, and optionally Search Console, Analytics and your WordPress site for one-click fixes. Setup takes about five minutes." },
  { q: "How fast will I see results?", a: "Profile fixes can move rankings within weeks, but it depends on your market. That's why the Map Pack Promise gives you 60 days: if your main keyword hasn't moved up, you get both months back." },
  { q: "Is there a contract?", a: "No. Every plan is month-to-month, and you can cancel any time from settings." },
];

/**
 * SAMPLE CONTENT. These businesses and people are fictional (the same ones used in
 * the product mock). While SAMPLE_CONTENT is true in site.ts, every page that shows
 * them labels them "Sample story". Replace with real, consented customer stories.
 */

export type CaseStudy = {
  slug: string;
  business: string;
  niche: string;
  city: string;
  audience: "owners" | "agencies";
  headline: string;
  summary: string;
  keyword: string;
  /** Map-pack rank for the main keyword, before and after. */
  rankBefore: number;
  rankAfter: number;
  /** The three businesses in the map pack before. Fictional, for the before/after visual. */
  rivals?: [string, string, string];
  /** Seeds for the before/after geo-grid visual (0 = weak, 1 = strong). */
  strengthBefore: number;
  strengthAfter: number;
  metrics: { value: string; label: string }[];
  challenge: string;
  timeline: { when: string; what: string }[];
  results: string[];
  quote: { text: string; name: string; role: string };
  services: string[];
};

export const caseStudies: CaseStudy[] = [
  {
    slug: "carter-plumbing",
    business: "Carter Plumbing & Drain",
    niche: "Plumbing",
    city: "Austin, TX",
    audience: "owners",
    headline: "From #9 to #3 for “plumber” in seven weeks",
    summary: "A 4.7-star plumber Google wasn't showing. Six fixes later, they're in the map pack across most of North Austin.",
    keyword: "plumber",
    rankBefore: 9,
    rankAfter: 3,
    rivals: ["Lone Star Plumbing", "Capitol Drain Co.", "Eastside Rooter"],
    strengthBefore: 0.25,
    strengthAfter: 0.72,
    metrics: [
      { value: "#9 → #3", label: "Map pack rank for “plumber”" },
      { value: "+41%", label: "Calls from Google, 28 days vs before" },
      { value: "6", label: "Fixes, 5 of them under an hour" },
    ],
    challenge: "Carter had better reviews than two of the three plumbers above them, but a single category, no service pages and an unclaimed duplicate listing. They ranked in the top 3 within half a mile of the shop and almost nowhere else.",
    timeline: [
      { when: "Week 1", what: "Merged the duplicate listing and added four secondary categories the leaders already used." },
      { when: "Week 2", what: "Added LocalBusiness schema and fixed title tags on the homepage and three service pages, from the To-do." },
      { when: "Weeks 3–7", what: "Weekly Google posts on autopilot and same-day replies to 38 new reviews." },
    ],
    results: ["Top 3 across most of North Austin, not just the half-mile around the shop", "Same-day replies to every new review", "Calls from Google up 41% against the previous 28 days"],
    quote: { text: "I knew we were good at the work. I didn't know Google couldn't tell. The audit showed me the six things, and four of them were done before I'd finished my coffee.", name: "Dana Carter", role: "Owner" },
    services: ["map-pack-tracking", "business-profile", "site-fixes"],
  },
  {
    slug: "maple-main-dental",
    business: "Maple & Main Dental",
    niche: "Dental",
    city: "Austin, TX",
    audience: "owners",
    headline: "Invisalign became a top-3 result, and calls followed",
    summary: "Map pack visibility up 9 points in a month, with review replies and site fixes running in the background.",
    keyword: "invisalign austin",
    rankBefore: 7,
    rankAfter: 2,
    rivals: ["Bright Smiles Austin", "Lakeline Dental Group", "Congress Ave Dentistry"],
    strengthBefore: 0.35,
    strengthAfter: 0.8,
    metrics: [
      { value: "+9 pts", label: "Share of local searches in the top 3" },
      { value: "+12%", label: "Calls from Google" },
      { value: "7", label: "Improvements shipped in a month" },
    ],
    challenge: "The practice ranked well for “dentist” but was invisible for its most valuable treatments. Review replies were weeks behind, and the Invisalign page was a single paragraph with no schema.",
    timeline: [
      { when: "Week 1", what: "Rebuilt the Invisalign service page from the To-do and added Dentist and MedicalProcedure schema." },
      { when: "Week 2", what: "Turned on review replies: 4 and 5-star replies automatic, everything else held for the office manager." },
      { when: "Weeks 3–4", what: "Added treatment photos and services the top 3 listed but Maple & Main didn't." },
    ],
    results: ["Top 3 for “invisalign austin” across most of the grid", "Every review answered within a day", "Named in Google's AI Overview for “best invisalign dentist austin”"],
    quote: { text: "Our office manager used to spend Friday afternoons on reviews. Now she approves a few replies from her phone, and the rest just happen.", name: "Dr. Priya Raman", role: "Practice owner" },
    services: ["reviews", "site-fixes", "ai-visibility"],
  },
  {
    slug: "round-rock-air",
    business: "Round Rock Air & Heat",
    niche: "HVAC",
    city: "Round Rock, TX",
    audience: "owners",
    headline: "Back in the map pack before the summer rush",
    summary: "A competitor's new location pushed them off the map. A refreshed profile and weekly posts brought them back in five weeks.",
    keyword: "ac repair round rock",
    rankBefore: 6,
    rankAfter: 2,
    rivals: ["Polar Air Round Rock", "Texan Comfort HVAC", "Hill Country Heating"],
    strengthBefore: 0.3,
    strengthAfter: 0.7,
    metrics: [
      { value: "#6 → #2", label: "Map pack rank for “ac repair”" },
      { value: "5 weeks", label: "To get back into the top 3" },
      { value: "+28%", label: "Direction requests and calls" },
    ],
    challenge: "A larger competitor opened a second location nearby, and Round Rock Air dropped from #2 to #6 in a month. Their profile hadn't been touched in two years.",
    timeline: [
      { when: "Week 1", what: "OpenMarko flagged the drop and the competitor that caused it." },
      { when: "Week 2", what: "Updated hours, added 20 job photos and the “AC repair” and “Heat pump” services." },
      { when: "Weeks 3–5", what: "Weekly seasonal posts and a review-request link added to every invoice." },
    ],
    results: ["Back to #2 for “ac repair round rock”", "62 new reviews in five weeks, all answered", "Calls and direction requests up 28%"],
    quote: { text: "The alert told us exactly who'd passed us and why. We'd have found out in August, from the phone not ringing.", name: "Marcus Webb", role: "General manager" },
    services: ["business-profile", "map-pack-tracking", "reviews"],
  },
  {
    slug: "bright-pine-digital",
    business: "Bright Pine Digital",
    niche: "Marketing agency",
    city: "Austin, TX",
    audience: "agencies",
    headline: "A two-person agency signed 6 clients from 120 audits",
    summary: "They replaced cold pitches with audit links. Prospects who opened an audit twice got a call, and a third of those calls became clients.",
    keyword: "hvac austin",
    rankBefore: 11,
    rankAfter: 3,
    strengthBefore: 0.2,
    strengthAfter: 0.68,
    metrics: [
      { value: "6", label: "New clients in 60 days" },
      { value: "52%", label: "Of sent audits were opened" },
      { value: "$2,994", label: "New monthly retainers" },
    ],
    challenge: "Bright Pine was sending generic SEO pitches to HVAC and plumbing companies and getting almost no replies. Each manual audit took them two hours.",
    timeline: [
      { when: "Week 1", what: "Searched “HVAC” within 15 miles of Austin and filtered to businesses ranked #4 to #15 with 4+ stars and no agency." },
      { when: "Weeks 2–6", what: "Sent 20 short emails a day, each with a link to that business's audit, and called anyone who opened it twice." },
      { when: "Week 7 on", what: "Converted each signed prospect into a client workspace, with the audit's plan already loaded as the To-do." },
    ],
    results: ["6 clients signed at $499/mo each", "Audit prep time down from 2 hours to under 5 minutes", "First client in the top 3 within six weeks"],
    quote: { text: "The audit does the selling. By the time we get on a call, they've already seen their map and they're asking how fast we can start.", name: "Leah Okafor", role: "Co-founder" },
    services: ["agency-prospecting", "map-pack-tracking"],
  },
];

export const caseStudyBySlug = (slug: string) => caseStudies.find((c) => c.slug === slug);

export type Testimonial = { text: string; name: string; role: string; business: string; story?: string };

export const testimonials: Testimonial[] = [
  { text: "I knew we were good at the work. I didn't know Google couldn't tell.", name: "Dana Carter", role: "Owner", business: "Carter Plumbing & Drain", story: "carter-plumbing" },
  { text: "The audit does the selling. By the time we get on a call, they're asking how fast we can start.", name: "Leah Okafor", role: "Co-founder", business: "Bright Pine Digital", story: "bright-pine-digital" },
  { text: "Our office manager approves a few replies from her phone, and the rest just happen.", name: "Dr. Priya Raman", role: "Practice owner", business: "Maple & Main Dental", story: "maple-main-dental" },
  { text: "The alert told us exactly who'd passed us and why. We'd have found out in August, from the phone not ringing.", name: "Marcus Webb", role: "General manager", business: "Round Rock Air & Heat", story: "round-rock-air" },
  { text: "Every other tool gave me a score. This one gave me a list, and then did most of the list.", name: "Tom Alvarez", role: "Owner", business: "Alvarez Roofing" },
  { text: "Seeing what each scan actually cost was the moment I trusted it. No mystery credits.", name: "Sam Whitfield", role: "Freelance SEO", business: "Whitfield Local" },
];

/** SAMPLE CONTENT. Video testimonials are placeholders until real, consented videos exist. */
export type VideoTestimonial = { name: string; role: string; business: string; story?: string; length: string; quote: string; transcript: string };

export const videoTestimonials: VideoTestimonial[] = [
  { name: "Dana Carter", role: "Owner", business: "Carter Plumbing & Drain", story: "carter-plumbing", length: "1:42", quote: "We paid an agency for two years and never saw a list of what they did.",
    transcript: "We paid an agency for two years and never saw a list of what they did. With Marko I get a text, I tap approve, and I can see the map turn green. We're in the top three for plumber now." },
  { name: "Dr. Priya Raman", role: "Practice owner", business: "Maple & Main Dental", story: "maple-main-dental", length: "2:05", quote: "Our reviews get answered the same day now, in our voice.",
    transcript: "Our reviews get answered the same day now, in our voice. My office manager approves a few from her phone. And when I asked ChatGPT for an Invisalign dentist, it named us." },
  { name: "Marcus Webb", role: "General manager", business: "Round Rock Air & Heat", story: "round-rock-air", length: "1:18", quote: "It told us who passed us and why, before the phone went quiet.",
    transcript: "It told us exactly who passed us and why, before the phone went quiet. Marko drafted the pages and categories they had. Two weeks later we were back in the map pack." },
];

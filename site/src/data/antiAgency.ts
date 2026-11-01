/**
 * Homepage copy for the anti-agency position ("Fire your agency. Marko does the work.").
 *
 * Lines marked PROPOSED are claims about agencies or savings that nobody has confirmed yet.
 * They describe what agencies typically charge or do, not any named agency. Confirm or
 * replace each one before launch; the confirmed offer and prices live in site.ts.
 */

export const hero = {
  title: "Fire your agency.",
  /** Second line: the accent word, then the rest in muted ink. */
  accent: "Marko",
  muted: "does the work.",
  /** The three places, each underlined and linked to the story on the page. */
  places: ["the AI answer", "the map pack", "the search results"],
  sub: "It studies your competitors, answers your reviews, fixes your website, writes your local pages and checks what AI says about you. You approve from your phone. No retainer, no contract, no monthly PDF.",
};

/** What owners say they got from an agency. Struck through on the page. General, not about any one agency. `{placeholders}` are filled from the persona (data/persona.ts). */
export const agencyPains = [
  { line: "A 14-page PDF every month", note: "Impressions up 3%. Calls? Not in the report." },
  { line: "A new account manager every quarter", note: "You explain your business again. And again." },
  { line: "A 12-month contract", note: "Plus a 90-day “ramp-up” before anything moves.", proposed: true },
  { line: "Ask ChatGPT for {one} near you", note: "You're not in the answer. Nobody's checking." },
];

/** The three places customers find a local business on one search. Every job moves one of them. */
export type Channel = "maps" | "google" | "ai";

/** The sample search the page follows, and the sample business. Demo data for the visuals. */
export const keyword = "plumber austin";
export const business = { name: "Carter Plumbing & Drain", domain: "carterplumbing.com" };

/** Where the sample business shows up for the keyword: map-pack rank, organic position, named in Google's AI answer. */
export type Presence = { maps: number; google: number; ai: boolean };
export const startPresence: Presence = { maps: 14, google: 23, ai: false };
export const endPresence: Presence = { maps: 1, google: 2, ai: true };

export type Job = {
  id: "competitors" | "reviews" | "profile" | "audit" | "pages" | "links" | "ai" | "citations" | "report";
  channel: Channel | "all";
  title: string;
  muted: string;
  body: string;
  /** What an agency typically hands over for the same job. */
  agency: string;
  /** Presence after this job, for the search mock. */
  after: Presence;
  stat?: { value: string; label: string; source: string };
};

export const jobs: Job[] = [
  {
    id: "competitors",
    channel: "all",
    title: "First, Marko studies",
    muted: "who's beating you.",
    body: "Marko pulls apart the businesses above you: their categories, reviews, photos, posts, service pages and where AI mentions them. Then it copies what works and does it better, and keeps watching for their next move.",
    agency: "A competitor slide in the kickoff deck. Never updated.",
    after: startPresence,
  },
  {
    id: "reviews",
    channel: "maps",
    title: "Every review answered,",
    muted: "the same day.",
    body: "Marko drafts a reply in your voice minutes after a review lands. Approve it with one tap, or let the four- and five-star ones post themselves.",
    agency: "Replies batched once a month, if they're in the package.",
    after: { maps: 9, google: 23, ai: false },
    stat: { value: "19%", label: "of customers now expect a reply the same day", source: "BrightLocal 2026" },
  },
  {
    id: "profile",
    channel: "maps",
    title: "Into the map pack,",
    muted: "street by street.",
    body: "Weekly posts, fresh photos and the categories the leaders use. Then Marko searches Google Maps from 49 points around you to see exactly where you moved and who's still ahead.",
    agency: "One average ranking number, once a month.",
    after: { maps: 3, google: 21, ai: false },
  },
  {
    id: "audit",
    channel: "google",
    title: "A site audit",
    muted: "that fixes itself.",
    body: "Marko crawls your whole website every week: missing schema, slow mobile pages, broken links, duplicate titles, the wrong phone number in the footer. Then it fixes them in WordPress, each with a revision you can roll back.",
    agency: "An audit PDF and a quote for the dev work.",
    after: { maps: 3, google: 11, ai: false },
  },
  {
    id: "pages",
    channel: "google",
    title: "A page for every service,",
    muted: "in every town you serve.",
    body: "People search “{service} {town}”, not “{generic}”. Marko finds the service and town combinations you're missing, writes local pages for them with schema and reviews, and publishes them when you say so.",
    agency: "Two blog posts a month about “industry trends”.",
    after: { maps: 2, google: 6, ai: false },
  },
  {
    id: "links",
    channel: "google",
    title: "Backlinks from your town,",
    muted: "not from link farms.",
    body: "Google trusts sites that local sites link to. Marko finds the links your competitors have and you don't: the chamber of commerce, suppliers' dealer pages, the Little League you sponsor, local news. Then it drafts the ask for you.",
    agency: "200 directory links from sites nobody has heard of.",
    after: { maps: 2, google: 3, ai: false },
  },
  {
    id: "ai",
    channel: "ai",
    title: "Recommended by AI,",
    muted: "not just ranked.",
    body: "Marko asks ChatGPT, Gemini, Perplexity and Google's AI the questions your customers ask, and shows whether you're named, who is named instead, and which sources they trust.",
    agency: "Not on the invoice yet.",
    after: { maps: 2, google: 3, ai: false },
    stat: { value: "45%", label: "of consumers used AI tools to find a local business this year", source: "BrightLocal 2026" },
  },
  {
    id: "citations",
    channel: "ai",
    title: "Citations everywhere",
    muted: "AI goes looking.",
    body: "AI answers and the map pack both lean on Yelp, Angi, the BBB, Apple Maps and local directories. Marko checks your name, address, phone and hours on every one, fixes what's wrong and adds you where you're missing.",
    agency: "A one-off listings cleanup, billed separately.",
    after: { maps: 1, google: 3, ai: true },
  },
  {
    id: "report",
    channel: "all",
    title: "One number that matters:",
    muted: "calls.",
    body: "Calls, direction requests and website clicks, week by week, next to the work that moved them. No impressions, no jargon.",
    agency: "Impressions, reach and a strategy call that keeps getting moved.",
    after: endPresence,
  },
];

/** Agency vs Marko. PROPOSED rows describe typical agency terms; confirm before launch. */
export const versus: { row: string; agency: string; marko: string; proposed?: boolean }[] = [
  { row: "Monthly cost", agency: "$1,500 to $5,000 retainer", marko: "From $99, usage shown at cost", proposed: true },
  { row: "Contract", agency: "6 to 12 months", marko: "Month to month, cancel in two clicks", proposed: true },
  { row: "AI search", agency: "Not in the package", marko: "Checked every week" },
  { row: "Competitors", agency: "A slide at kickoff", marko: "Watched weekly, moves copied and beaten" },
  { row: "Review replies", agency: "Days later, if at all", marko: "Drafted within minutes" },
  { row: "What you see", agency: "A PDF at the end of the month", marko: "Every change, before it goes live" },
  { row: "When you leave", agency: "They keep the logins", marko: "Your data and reports export with you" },
];

/** PROPOSED: a typical local-agency retainer, against the $99 Local plan. */
export const savings = { agencyMonthly: 2500, markoMonthly: 99 };

export const faqs = [
  { q: "Do I need to know anything about marketing?", a: "No. Marko works out what to do and explains each change in plain words. Your job is to say yes, edit, or skip, usually from your phone in under five minutes a week." },
  { q: "What does “AI search” mean for a local business?", a: "More people now ask ChatGPT, Gemini or Google's AI “who's the best {search} near me?” instead of scrolling results. Those answers name a few businesses. Marko checks whether you're one of them and fixes the listings and pages the AI reads." },
  { q: "I'm still under contract with an agency. Now what?", a: "Run the free audit first. It shows what Marko would fix this week, which is a useful thing to put in front of your agency. When your contract ends, connect your Google Business Profile and Marko picks up from there." },
  { q: "Is Marko a person?", a: "Marko is AI, built into OpenMarko. It drafts, checks and applies the work. You approve it, and nothing goes live without your say-so unless you turn on Autopilot for that kind of change." },
  { q: "Will replies and posts sound like a robot?", a: "Marko writes from your Brand voice: your services, offers, hours and the way you talk. Edit any draft and Marko learns from it." },
  { q: "Is there a contract?", a: "No. Every plan is month to month, and you can cancel any time from settings." },
];

export const finalCta = {
  title: "Your agency sends a report.",
  muted: "sends results.",
  sub: "Enter your business. In a few minutes you'll see where you show up on Maps, Google and AI, who's taking your calls, and the work Marko would do this week.",
};

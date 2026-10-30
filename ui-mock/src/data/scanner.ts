// Social scanner: conversations happening on other people's platforms that the
// business should join. (What's trending to remix lives in data/social.ts.)
// Mock data for Maple & Main Dental; posts and authors are made up.
//
// Real build: a scheduled job searches each platform for the business's
// listening terms (services + city, its name, competitor names) — Reddit search
// API, X recent search API, Quora and Nextdoor via web search, Facebook groups
// the business has joined via the Graph API where allowed. Claude scores each
// hit for intent and fit, and the Community replies skill drafts the reply in
// the brand voice. Replying always happens on the platform, by a person.

export type PlatformId = "reddit" | "quora" | "fbgroups" | "x" | "nextdoor" | "instagram" | "tiktok" | "linkedin" | "youtube";
/** `login`: scanning needs a connected account; otherwise it uses public search. `places`: what the user picks to watch on it. */
export type Platform = { id: PlatformId; name: string; short: string; bg: string; fg: string; home: string; login: boolean; places: string };

export const platforms: Platform[] = [
  { id: "reddit", name: "Reddit", short: "r/", bg: "#ff4500", fg: "#fff", home: "https://www.reddit.com", login: false, places: "Subreddits" },
  { id: "quora", name: "Quora", short: "Q", bg: "#b92b27", fg: "#fff", home: "https://www.quora.com", login: false, places: "Topics" },
  { id: "fbgroups", name: "Facebook groups", short: "f", bg: "#1877f2", fg: "#fff", home: "https://www.facebook.com/groups", login: true, places: "Groups you've joined" },
  { id: "x", name: "X", short: "X", bg: "#000", fg: "#fff", home: "https://x.com", login: true, places: "Searches near you" },
  { id: "nextdoor", name: "Nextdoor", short: "n", bg: "#8ed500", fg: "#0b3d0b", home: "https://nextdoor.com", login: true, places: "Neighborhoods" },
  { id: "instagram", name: "Instagram comments", short: "IG", bg: "#d62976", fg: "#fff", home: "https://www.instagram.com", login: true, places: "Hashtags and accounts" },
  { id: "tiktok", name: "TikTok comments", short: "TT", bg: "#111", fg: "#fff", home: "https://www.tiktok.com", login: true, places: "Hashtags" },
  { id: "linkedin", name: "LinkedIn", short: "in", bg: "#0a66c2", fg: "#fff", home: "https://www.linkedin.com", login: true, places: "Hashtags and groups" },
  { id: "youtube", name: "YouTube comments", short: "YT", bg: "#ff0000", fg: "#fff", home: "https://www.youtube.com", login: false, places: "Search terms" },
];
export const platformOf = (id: PlatformId) => platforms.find((p) => p.id === id)!;


export type OppKind = "Asking for a dentist" | "Question you can answer" | "Mentions you";
export type Opportunity = {
  id: string;
  platform: PlatformId;
  community: string;
  url: string;
  title: string;
  excerpt: string;
  author: string;
  age: string;
  stats: string;
  kind: OppKind;
  why: string;
  fit: number;
  tips: string[]; // the platform's or community's norms
  draft: string;
};

export const opportunities: Opportunity[] = [
  {
    id: "op1", platform: "reddit", community: "r/Austin", url: "https://www.reddit.com/r/Austin/",
    title: "Cracked a molar, need a dentist this weekend. Who's actually open?",
    excerpt: "Bit down on something at dinner and half my back tooth is gone. Not in crazy pain but it's sharp. Do I need the ER or can this wait until Monday? South Austin if it matters.",
    author: "u/breakfasttacoenjoyer", age: "2h ago", stats: "23 comments · 41 upvotes", kind: "Asking for a dentist", fit: 96,
    why: "Asking for exactly your service, 1.2 miles from the office, and still open: no dentist has answered yet.",
    tips: ["Say you're a dentist and where. r/Austin is fine with that; it isn't fine with ads.", "Answer the question first. Mention the office once, at the end.", "No links unless someone asks."],
    draft: "Dentist on South Congress here, so take this with that in mind.\n\nIf it's sharp but there's no swelling or fever, it can usually wait until Monday. Take ibuprofen, chew on the other side, and cover the sharp edge with sugar-free gum or dental wax from any pharmacy. If you get swelling in your face, a fever, or pain that wakes you up, go to urgent care instead of waiting.\n\nMost offices keep same-day slots for exactly this on Monday mornings (we do, we open at 7:30), so call as soon as they open.",
  },
  {
    id: "op2", platform: "fbgroups", community: "South Austin Parents", url: "https://www.facebook.com/groups",
    title: "Recommendations for a kid-friendly dentist near 78704?",
    excerpt: "Our 4yo needs her first checkup and is terrified of doctors. Looking for somewhere patient and not rushed. Bonus if they do Saturdays!",
    author: "Megan L.", age: "5h ago", stats: "41 comments · 3 name competitors", kind: "Asking for a dentist", fit: 91,
    why: "Parents near your office asking for kids' dentistry and Saturday hours, which you have. Three competitors are already named in the comments.",
    tips: ["Groups often ban businesses posting for themselves. Reply as Dr. Patel, not the page.", "Lead with a tip for a nervous 4-year-old; recommend yourself second.", "Check the group rules for a weekly promo thread."],
    draft: "Hi Megan! I'm a dentist at Maple & Main on South Congress. A tip for a first visit: book it as a \"happy visit\" where she just rides the chair up and down and counts her teeth, no cleaning unless she's up for it. Most kids are fine by visit two.\n\nWe do see kids on Saturday mornings if that helps. Happy to answer anything here too.",
  },
  {
    id: "op3", platform: "reddit", community: "r/Austin", url: "https://www.reddit.com/r/Austin/",
    title: "Has anyone been to Maple & Main Dental on S Congress?",
    excerpt: "Thinking of switching dentists. Their reviews look good but I want real opinions. Do they push a lot of extra treatments?",
    author: "u/atx_newbie_22", age: "1d ago", stats: "12 comments · 18 upvotes", kind: "Mentions you", fit: 94,
    why: "Someone is deciding whether to book you. The top comment is positive; answering their upselling worry directly is worth it.",
    tips: ["Thank the people who answered before you.", "Be plain about prices; don't argue with anyone.", "One reply is enough. Don't ask patients to pile in."],
    draft: "Dr. Patel from Maple & Main here. Thanks to everyone who answered first, that's really kind.\n\nOn the upselling question: a checkup is an exam, a cleaning, and X-rays when they're due, and we tell you the price before anything else. If we suggest treatment we'll show you the X-ray and what happens if you wait. If you'd like a second opinion on a quote from somewhere else, bring it in and we'll give you a straight answer.",
  },
  {
    id: "op4", platform: "x", community: "Austin, recent posts", url: "https://x.com/search?q=dentist%20austin",
    title: "anyone know a dentist in austin that takes walk-ins?? tooth is killing me",
    excerpt: "", author: "@jessmakesthings", age: "35m ago", stats: "4 replies", kind: "Asking for a dentist", fit: 83,
    why: "Urgent and local. Short replies work on X; the first useful one gets seen.",
    tips: ["Keep it short and human; no hashtags.", "Reply from the business account."],
    draft: "So sorry, that sounds awful. We keep same-day emergency slots on South Congress every weekday. Call us when we open at 7:30 and we'll get you in. If there's swelling or a fever, urgent care tonight.",
  },
  {
    id: "op5", platform: "quora", community: "Quora · Dentistry", url: "https://www.quora.com",
    title: "Is it worth getting Invisalign in your 40s?",
    excerpt: "I'm 43 and my lower teeth have gotten more crowded over the years. Is it too late, and does it take longer for adults?",
    author: "Asked by a Quora user", age: "3d ago", stats: "1.2k views this week · ranks on Google", kind: "Question you can answer", fit: 78,
    why: "Quora answers rank on Google for “invisalign at 40”, and AI answers quote them. A clear expert answer keeps working for months.",
    tips: ["Credentials go in your profile line, not the answer.", "Long, specific answers rank best on Quora.", "A link to your site is allowed at the end if it's genuinely useful."],
    draft: "Not too late at all. Many of the people starting Invisalign are in their 40s or older, and lower-teeth crowding that's crept in over the years is one of the most common reasons.\n\nA few things are different for adults: treatment often takes a little longer (roughly 12–18 months for moderate crowding), you'll want your gums checked first, and wearing a retainer at night afterwards matters more, since teeth keep drifting with age.\n\nThe best next step is a consult with a scan, so you can see the likely result and timeline before deciding.",
  },
  {
    id: "op6", platform: "nextdoor", community: "Travis Heights", url: "https://nextdoor.com",
    title: "Dentist that doesn't upsell?",
    excerpt: "Last place told me I needed 6 fillings, second opinion said zero. Who do you trust around here?",
    author: "Rob K., Travis Heights", age: "8h ago", stats: "17 replies", kind: "Asking for a dentist", fit: 88,
    why: "A neighbor 0.6 miles away who wants honesty, which is what your brand stands for.",
    tips: ["Nextdoor shows your business badge, so you don't need to introduce yourself as one.", "Neighborly tone; no promotions in replies."],
    draft: "Sorry that happened, Rob. A good rule: ask any dentist to show you the X-ray and point at each spot before you agree to fillings. Small early spots can often be watched instead of filled.\n\nWe're on South Congress and happy to take a look at a second opinion any time. We'll tell you the price before anything else.",
  },
  {
    id: "op7", platform: "reddit", community: "r/askdentists", url: "https://www.reddit.com/r/askdentists/",
    title: "Whitening toothpaste vs strips, which actually works?",
    excerpt: "Is whitening toothpaste a scam? Thinking of buying strips before a wedding in 3 weeks.",
    author: "u/goldenhour_smiles", age: "6h ago", stats: "9 comments", kind: "Question you can answer", fit: 64,
    why: "Not local, but it matches a topic trending this week; the same answer can become a TikTok.",
    tips: ["r/askdentists asks verified dentists to flair up first.", "No self-promotion at all here: answer only."],
    draft: "Whitening toothpaste only removes surface stains (coffee, tea), so it can look a little brighter but won't change the tooth's color. Strips use peroxide, so they actually whiten. With 3 weeks, strips are fine: start now, follow the box, and stop if your teeth get sensitive. Skip anything very abrasive, and look for the ADA Seal.",
  },
];

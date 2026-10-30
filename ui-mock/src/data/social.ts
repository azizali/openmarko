// Social: the Organization's Accounts and trending ideas to remix. Mock data for
// Maple & Main Dental. Terms follow GLOSSARY.md: a Post goes to Accounts; each
// Account lives on a Platform and speaks for the whole Organization unless it's
// tagged to one Location. A Location's Google Business Profile is an Account too.
//
// Real build:
// - Posting: Meta Graph API (Instagram + Facebook pages), TikTok Content
//   Posting API, LinkedIn Posts API; Google Business Profile localPosts per Location.
// - Trends: TikTok Creative Center and Instagram Reels trends for the category,
//   Google Trends for the metro, Reddit search for the city and niche, local
//   news RSS. Each candidate is scored for velocity and fit, then Claude writes
//   the "why it works" insight and the remix.
// - Voice: every draft is written with the Organization's Brand voice
//   (data/brand.ts) as background, through the matching skill (data/skills.ts).

import { voice } from "./brand";
import { locations } from "./mock";

export type SocialPlatform = "instagram" | "facebook" | "tiktok" | "x" | "linkedin" | "google";
export const platformMeta: Record<SocialPlatform, { name: string; short: string; color: string }> = {
  instagram: { name: "Instagram", short: "IG", color: "#d62976" },
  facebook: { name: "Facebook", short: "f", color: "#1877f2" },
  tiktok: { name: "TikTok", short: "TT", color: "#111111" },
  x: { name: "X", short: "X", color: "#000000" },
  linkedin: { name: "LinkedIn", short: "in", color: "#0a66c2" },
  google: { name: "Google profile", short: "G", color: "#5f6368" },
};

export type AccountId = string;
export type Account = {
  id: AccountId;
  platform: SocialPlatform;
  handle: string;
  locationId?: string; // tagged to one Location; otherwise it speaks for the whole Organization
  connected: boolean;
  followers: number;
  followersPrev: number;
};

export const accounts: Account[] = [
  { id: "instagram", platform: "instagram", handle: "@mapleandmaindental", connected: true, followers: 2140, followersPrev: 2032 },
  { id: "instagram-mueller", platform: "instagram", handle: "@mapleandmain.mueller", locationId: "loc_2", connected: true, followers: 640, followersPrev: 588 },
  { id: "facebook", platform: "facebook", handle: "Maple & Main Dental", connected: true, followers: 1380, followersPrev: 1366 },
  { id: "tiktok", platform: "tiktok", handle: "@drpatel.atx", connected: true, followers: 860, followersPrev: 512 },
  { id: "x", platform: "x", handle: "@mapleandmaindds", connected: true, followers: 410, followersPrev: 396 },
  { id: "linkedin", platform: "linkedin", handle: "Dr. Anika Patel", connected: false, followers: 0, followersPrev: 0 },
  { id: "google", platform: "google", handle: "South Congress", locationId: "loc_1", connected: true, followers: 0, followersPrev: 0 },
  { id: "google-mueller", platform: "google", handle: "Mueller", locationId: "loc_2", connected: true, followers: 0, followersPrev: 0 },
];

export const accountOf = (id: AccountId) => accounts.find((a) => a.id === id)!;
export const platformOf = (id: AccountId) => accountOf(id).platform;
const locationName = (id?: string) => locations.find((l) => l.id === id)?.name.split(" — ")[1];
/** "Instagram · Mueller", or just "Instagram" for an Organization-wide Account. */
export const accountLabel = (id: AccountId) => {
  const a = accountOf(id);
  const loc = locationName(a.locationId);
  return a.platform === "google" ? `Google profile · ${loc}` : loc ? `${platformMeta[a.platform].name} · ${loc}` : platformMeta[a.platform].name;
};
/** The Organization-wide Account on a Platform (for Google, the first Location's profile). */
export const mainAccount = (p: SocialPlatform) => accounts.find((a) => a.platform === p && (!a.locationId || p === "google"));

// ---------- Trending ideas ----------

export type TrendSourceId = "tiktok" | "reels" | "gtrends" | "reddit" | "x" | "news";
export const trendSources: { id: TrendSourceId; name: string; what: string }[] = [
  { id: "tiktok", name: "TikTok", what: "Rising formats, sounds and hashtags in your category" },
  { id: "reels", name: "Instagram Reels", what: "Formats getting unusual saves and shares" },
  { id: "gtrends", name: "Google Trends", what: "Searches rising in your area" },
  { id: "reddit", name: "Reddit", what: "Top threads in your city and niche subreddits" },
  { id: "x", name: "X", what: "Topics picking up near you" },
  { id: "news", name: "Local news & events", what: "Dates, events and stories in your city" },
];

export type TrendKind = "Format" | "Topic" | "Local" | "Seasonal";
export type Remix = {
  hook: string;
  playfulHook: string;
  body: string;
  expertLine: string;
  cta: string;
  hashtags: string[];
  format: string;
  scenes?: string[];
};
export type Trend = {
  id: string;
  kind: TrendKind;
  title: string;
  source: string;
  velocity: string;
  fit: number; // 0–100: how well it suits this business and its voice
  seen: string; // what the trending original looks like
  insight: string; // why it works, underneath
  angle: string; // the remix in one line
  bestFor: SocialPlatform[];
  from: TrendSourceId[]; // where the scanner saw it
  remix: Remix;
};

export const trends: Trend[] = [
  {
    id: "tr1", kind: "Format", title: "“Things I'd never do as a…” insider lists",
    source: "TikTok & Reels · dental and health creators", velocity: "+340% posts this week", fit: 92,
    seen: "A professional faces the camera and lists 4–5 habits they personally avoid, one per cut, with on-screen text.",
    insight: "It feels like a secret from someone who knows. Viewers stay to see if they do the thing, and share it with whoever does.",
    angle: "Dr. Patel: 5 things I'd never do as a dentist, filmed in the South Congress office.",
    bestFor: ["tiktok", "instagram"], from: ["tiktok", "reels"],
    remix: {
      hook: "5 things I'd never do as a dentist.",
      playfulHook: "Dentist here. Please stop doing #3.",
      body: "1. Brush right after coffee (wait 30 minutes). 2. Chew ice. 3. Use my teeth to open things. 4. Skip flossing because my gums bleed. That's exactly when to keep going. 5. Wait for a toothache to book a checkup.",
      expertLine: "Acid from coffee softens enamel for about half an hour, so brushing straight away scrubs it off.",
      cta: "Which one are you guilty of? No judgment, just tell us.",
      hashtags: ["#dentisttok", "#austintx", "#teethtips", "#southcongress"],
      format: "Reel / TikTok · 30s · 5 cuts",
      scenes: ["Dr. Patel at the chair: “5 things I'd never do as a dentist.”", "Coffee cup + toothbrush, text: “Brush right after coffee”", "Ice glass, text: “Chew ice”", "Bottle cap, text: “Open things with my teeth”", "Floss, text: “Stop flossing when gums bleed”", "Calendar, text: “Wait for pain to book”, end on the front desk waving"],
    },
  },
  {
    id: "tr2", kind: "Seasonal", title: "Clocks go back this Sunday",
    source: "Google Trends · Austin", velocity: "“daylight saving” searches ×6 this week", fit: 84,
    seen: "Brands tie a small habit to the time change: “change your clocks, change your smoke alarm battery.”",
    insight: "A date everyone already knows makes a reminder stick. It's useful, so people don't feel sold to.",
    angle: "Change your clocks, change your toothbrush. A twice-a-year reminder with a free brush at your next visit.",
    bestFor: ["instagram", "facebook", "google"], from: ["gtrends", "news"],
    remix: {
      hook: "Change your clocks, change your toothbrush.",
      playfulHook: "Your toothbrush is older than your last haircut. Clocks go back Sunday. Perfect timing.",
      body: "Clocks go back this Sunday, Nov 1. It's an easy way to remember: a new toothbrush every time the clocks change, and a new head every 3 months if you use an electric one.",
      expertLine: "Worn bristles clean noticeably less plaque, and you can't always see the wear.",
      cta: "Mention this post at your next visit and we'll hand you a new brush.",
      hashtags: ["#daylightsaving", "#austin", "#toothbrush", "#smallhabits"],
      format: "Single image + caption",
    },
  },
  {
    id: "tr3", kind: "Local", title: "“Any dentists in Austin that don't upsell?”",
    source: "Reddit · r/Austin thread, 214 comments", velocity: "Top post in r/Austin today", fit: 88,
    seen: "Locals trade names of dentists who were honest about what they didn't need, and warn about ones who weren't.",
    insight: "People don't fear the drill as much as the bill. Being open about what you won't sell builds more trust than a discount.",
    angle: "What we'll never upsell you on, and what a fair checkup includes. Prices on the post.",
    bestFor: ["facebook", "x", "google"], from: ["reddit"],
    remix: {
      hook: "Things we'll never try to sell you.",
      playfulHook: "Hot take from a dentist: you probably don't need that.",
      body: "Deep cleanings you don't need. Whitening at every visit. Replacing fillings that are fine. A checkup here is an exam, a cleaning and X-rays when they're due, and we tell you the price before anything else.",
      expertLine: "If we suggest treatment, we'll show you the X-ray and tell you what happens if you wait.",
      cta: "Questions about a quote you got somewhere else? Send it over and we'll give you a straight answer.",
      hashtags: ["#austin", "#honestdentist", "#atx"],
      format: "Carousel · 4 slides",
      scenes: ["“Things we'll never try to sell you”", "Deep cleanings you don't need · Whitening at every visit", "Replacing fillings that are fine", "What a checkup includes + price"],
    },
  },
  {
    id: "tr4", kind: "Topic", title: "“Is whitening toothpaste a scam?”",
    source: "Google Trends + TikTok search", velocity: "+180% searches in 30 days", fit: 76,
    seen: "Creators test drugstore whitening products on camera and argue about whether they work.",
    insight: "Everyone has bought one. A straight, expert answer settles the argument and earns saves.",
    angle: "A 20-second straight answer from Dr. Patel, plus what actually works for different budgets.",
    bestFor: ["tiktok", "instagram", "x"], from: ["gtrends", "tiktok"],
    remix: {
      hook: "Is whitening toothpaste a scam? Straight answer.",
      playfulHook: "I tried to defend whitening toothpaste. I couldn't. Mostly.",
      body: "It removes surface stains from coffee and tea, so teeth can look a shade brighter. It won't change the color of the tooth itself. For that you need peroxide, either strips or a tray from your dentist.",
      expertLine: "Look for the ADA Seal; some whitening pastes are abrasive enough to wear enamel over time.",
      cta: "Want to know which option fits your budget? Ask us at your next cleaning.",
      hashtags: ["#teethwhitening", "#dentisttok", "#austin"],
      format: "Reel / TikTok · 20s · talking head",
    },
  },
  {
    id: "tr5", kind: "Format", title: "“Day in the life” of a small business owner",
    source: "Reels · local business accounts", velocity: "+95% saves vs. other formats", fit: 71,
    seen: "Fast clips from opening up to closing, with a voiceover on one small moment that mattered.",
    insight: "People pick a dentist they feel they already know. Showing the team does that faster than any ad.",
    angle: "A day at Maple & Main, from the 7:30 coffee to the last patient, told by the front desk.",
    bestFor: ["instagram", "tiktok"], from: ["reels"],
    remix: {
      hook: "A day at a neighborhood dental office.",
      playfulHook: "POV: you work the front desk at a dentist and everyone's a little nervous.",
      body: "7:30 coffee. 8:00 first cleaning. 10:15 a same-day chipped tooth. Noon tacos on South Congress. 3:00 a kid's first visit and the treasure box. 5:30 lights off.",
      expertLine: "Most of our day is prevention, which is the boring part that saves you money.",
      cta: "Come say hi. The treasure box is for grown-ups too.",
      hashtags: ["#dayinthelife", "#smallbusinessatx", "#southcongress"],
      format: "Reel · 25s · 7 clips",
      scenes: ["Coffee + lights on", "First patient chair", "Same-day emergency (no faces)", "Tacos on South Congress", "Kid's first visit", "Treasure box", "Lights off, door closes"],
    },
  },
];

export type ToneTweak = "shorter" | "playful" | "expert";

/** Joins the parts that aren't empty with blank lines. */
const paras = (...parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join("\n\n");

/** X counts 280 characters; cut at the last full sentence that fits. */
const x280 = (t: string) => {
  if (t.length <= 280) return t;
  const cut = t.slice(0, 280);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "));
  return end > 80 ? cut.slice(0, end + 1) : `${cut.slice(0, 277)}…`;
};

/** Writes the remix for one Platform, following its norms and the brand voice. */
export function draftFor(t: Trend, ch: SocialPlatform, tweaks: ToneTweak[] = []): string {
  const r = t.remix;
  const hook = tweaks.includes("playful") ? r.playfulHook : r.hook;
  const body = tweaks.includes("shorter") ? r.body.split(/(?<=\.)\s/)[0] : r.body;
  const expert = tweaks.includes("expert") ? ` ${r.expertLine}` : "";
  switch (ch) {
    case "instagram": return paras(hook, body + expert, r.cta, r.hashtags.join(" "));
    case "tiktok": return `${hook} ${r.hashtags.slice(0, 3).join(" ")}`.trim();
    case "facebook": return paras(hook, body + expert, r.cta, voice.signOff);
    case "x": return x280(paras(hook, body + expert));
    case "linkedin": return paras(r.hook, `${r.body} ${r.expertLine}`.trim(), "What's worked for your practice?");
    case "google": return `${hook} ${body.split(/(?<=\.)\s/)[0]}${expert} ${r.cta}`.replace(/\s+/g, " ").trim();
  }
}

/** Best time to post on each Platform, from the Organization's past engagement. */
export const bestTime: Record<SocialPlatform, string> = {
  instagram: "Tue 7:30 PM", tiktok: "Wed 8:00 PM", x: "Tue 12:00 PM", facebook: "Thu 12:15 PM", linkedin: "Tue 8:00 AM", google: "Mon 9:00 AM",
};

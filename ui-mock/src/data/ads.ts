// Ads: the Organization's ad accounts, what its campaigns are doing, other
// advertisers' ads to learn from, and the building blocks for new creatives.
// Mock data for Maple & Main Dental.
//
// Real build:
// - Ad accounts: Meta Marketing API (campaigns, ad sets, ads, insights),
//   Google Ads API (campaigns, ad groups, responsive search ads, search terms),
//   TikTok Marketing API. One OAuth per platform, then pick the ad account.
// - Results: Meta Pixel + Conversions API and Google Ads conversions with
//   enhanced conversions, call tracking (CallRail) and the booking system, so a
//   "result" is a booked patient, not a click.
// - Research: Meta Ad Library (API covers EU/UK delivery only, so US ads come
//   from a scraper such as an Apify actor), Google Ads Transparency Center
//   (SerpApi), TikTok Creative Center top ads. Days running and the number of
//   versions an advertiser keeps live are the signals that an ad is working.
// - Creatives: Claude writes the copy with the brand voice and the Ad creative
//   skill; images are rendered from templates (Creatomate or Bannerbear) with
//   generated or uploaded photos, so every size comes from one design.

import { business } from "./mock";

export type AdPlatform = "meta" | "google" | "tiktok";
export const adPlatforms: Record<AdPlatform, { name: string; short: string; color: string; where: string }> = {
  meta: { name: "Meta Ads", short: "M", color: "#0866ff", where: "Facebook and Instagram" },
  google: { name: "Google Ads", short: "G", color: "#1a73e8", where: "Search, Maps and YouTube" },
  tiktok: { name: "TikTok Ads", short: "TT", color: "#111111", where: "TikTok" },
};

export type Format = "image" | "carousel" | "video" | "search";
export const formats: Record<Format, { label: string; platforms: AdPlatform[] }> = {
  image: { label: "Image", platforms: ["meta", "tiktok"] },
  carousel: { label: "Carousel", platforms: ["meta"] },
  video: { label: "Short video", platforms: ["meta", "tiktok", "google"] },
  search: { label: "Search ad", platforms: ["google"] },
};

export type Size = "1:1" | "4:5" | "9:16" | "1.91:1";
export const sizes: { id: Size; label: string; where: string }[] = [
  { id: "1:1", label: "Square 1:1", where: "Feed" },
  { id: "4:5", label: "Portrait 4:5", where: "Feed, takes more of the screen" },
  { id: "9:16", label: "Tall 9:16", where: "Stories, Reels and TikTok" },
  { id: "1.91:1", label: "Wide 1.91:1", where: "Right column and Google display" },
];

export type Angle = "price" | "pain" | "proof" | "convenience" | "authority" | "compare" | "deadline";
export const angles: Record<Angle, { label: string; blurb: string; hue: number }> = {
  price: { label: "Price upfront", blurb: "Say what it costs before they ask", hue: 152 },
  pain: { label: "Fix it today", blurb: "Toothache, chipped tooth, lost filling: seen today", hue: 18 },
  proof: { label: "Reviews", blurb: "What patients say, in their words", hue: 45 },
  convenience: { label: "Easy to fit in", blurb: "Saturdays, early hours, two locations", hue: 200 },
  authority: { label: "Meet the dentist", blurb: "Dr. Patel, on camera, explaining one thing", hue: 265 },
  compare: { label: "Not a chain", blurb: "Same dentist every visit, no upsell", hue: 330 },
  deadline: { label: "Use it or lose it", blurb: "Insurance benefits reset December 31", hue: 0 },
};

/** Where a result is counted. The goal is set in results, so this decides what Marko optimizes for. */
export type ResultKind = "booking" | "lead" | "call";
export const resultKinds: Record<ResultKind, { label: string; one: string; many: string }> = {
  booking: { label: "Booked appointments", one: "booking", many: "bookings" },
  lead: { label: "Form leads", one: "lead", many: "leads" },
  call: { label: "Calls over 60 seconds", one: "call", many: "calls" },
};

// ---------- Connections ----------

export type ToolId = AdPlatform | "pixel" | "gads_conv" | "callrail" | "booking" | "creatomate" | "canva" | "foreplay";
export type ToolGroup = "Ad accounts" | "Counting results" | "Making creatives" | "Research";
export type Tool = { id: ToolId; group: ToolGroup; name: string; mark: string; color: string; what: string; account: string; needs?: AdPlatform };
export const tools: Tool[] = [
  { id: "meta", group: "Ad accounts", name: "Meta Ads", mark: "M", color: "#0866ff", what: "Publish to Facebook and Instagram, read results, pause and change budgets", account: "Maple & Main Dental (act_2049…118)" },
  { id: "google", group: "Ad accounts", name: "Google Ads", mark: "G", color: "#1a73e8", what: "Search ads, search terms, budgets and bids", account: "Maple & Main Dental · 418-220-7731" },
  { id: "tiktok", group: "Ad accounts", name: "TikTok Ads", mark: "TT", color: "#111111", what: "Publish short videos and read results", account: "Maple & Main · Ads Manager" },
  { id: "pixel", group: "Counting results", name: "Meta Pixel + Conversions API", mark: "Px", color: "#0866ff", what: "Tells Meta which clicks booked, so it finds more people like them", account: "Pixel 7781… on mapleandmaindental.com", needs: "meta" },
  { id: "gads_conv", group: "Counting results", name: "Google Ads conversions", mark: "Cv", color: "#1a73e8", what: "Bookings and calls counted in Google Ads, with enhanced conversions", account: "3 conversion actions", needs: "google" },
  { id: "callrail", group: "Counting results", name: "CallRail", mark: "CR", color: "#0e7a5f", what: "Counts phone calls from each ad and how long they lasted", account: "2 tracking numbers" },
  { id: "booking", group: "Counting results", name: "Booking system", mark: "Bk", color: "#7c3aed", what: "Counts a booked patient as the result, not just a form fill (NexHealth, Calendly, your CRM)", account: "NexHealth · 2 locations" },
  { id: "creatomate", group: "Making creatives", name: "Creatomate", mark: "Cm", color: "#ef4444", what: "Renders each creative in every size and turns scripts into short videos", account: "Workspace: maple-main" },
  { id: "canva", group: "Making creatives", name: "Canva", mark: "Ca", color: "#00c4cc", what: "Use your brand kit and open any creative in Canva to fine-tune", account: "Brand kit: Maple & Main" },
  { id: "foreplay", group: "Research", name: "Foreplay", mark: "Fp", color: "#f97316", what: "Bring in boards you've already saved there", account: "2 boards" },
];
export const toolOf = (id: ToolId) => tools.find((t) => t.id === id)!;

// ---------- Your campaigns ----------

export type Level = "campaign" | "adset" | "ad";
export type RowStatus = "active" | "paused";
export type AdCopy = { angle: Angle; format: Format; headline: string; text: string; hue: number };
export type Row = {
  id: string;
  level: Level;
  parentId?: string;
  campaignId: string;
  platform: AdPlatform;
  name: string;
  status: RowStatus;
  budget?: number; // daily, on whichever level owns the budget
  spend: number; // last 7 days
  results: number;
  impressions: number;
  clicks: number;
  frequency?: number;
  ctrTrend: number[]; // CTR % per day, oldest first
  wasteTerms?: string[]; // Google search terms that spent money and never booked
  limitedBy?: number; // % of searches missed because the budget ran out
  copy?: AdCopy;
  fromStudio?: string; // the batch it was made in
  quality?: number; // 0–1, the studio's score; the mock uses it to simulate results
  startedDaysAgo: number;
};

const ad = (r: Omit<Row, "level">): Row => ({ level: "ad", ...r });

export const seedRows: Row[] = [
  { id: "c_np", level: "campaign", campaignId: "c_np", platform: "meta", name: "New patients · Austin", status: "active", budget: 60, spend: 0, results: 0, impressions: 0, clicks: 0, ctrTrend: [], startedDaysAgo: 41 },
  { id: "s_soco", level: "adset", parentId: "c_np", campaignId: "c_np", platform: "meta", name: "South Congress · 3 mi", status: "active", spend: 0, results: 0, impressions: 0, clicks: 0, ctrTrend: [], startedDaysAgo: 41 },
  ad({ id: "a_price", parentId: "s_soco", campaignId: "c_np", platform: "meta", name: "$129 new patient visit", status: "active", spend: 168, results: 4, impressions: 14200, clicks: 248, frequency: 1.8, ctrTrend: [1.7, 1.8, 1.7, 1.8, 1.8, 1.7, 1.8], startedDaysAgo: 41,
    copy: { angle: "price", format: "image", headline: "New patient visit, $129. That's the whole price.", text: "Exam, X-rays and cleaning for $129 without insurance. You'll know every price before we start. South Congress & Mueller.", hue: 152 } }),
  ad({ id: "a_tonight", parentId: "s_soco", campaignId: "c_np", platform: "meta", name: "Toothache tonight?", status: "active", spend: 131, results: 2, impressions: 16900, clicks: 152, frequency: 4.2, ctrTrend: [1.5, 1.4, 1.2, 1.1, 1.0, 0.9, 0.9], startedDaysAgo: 38,
    copy: { angle: "pain", format: "image", headline: "Toothache can't wait. Neither do we.", text: "Same-day emergency slots every weekday at South Congress. Call by noon, seen today.", hue: 18 } }),
  { id: "s_mueller", level: "adset", parentId: "c_np", campaignId: "c_np", platform: "meta", name: "Mueller · 3 mi", status: "active", spend: 0, results: 0, impressions: 0, clicks: 0, ctrTrend: [], startedDaysAgo: 41 },
  ad({ id: "a_reviews", parentId: "s_mueller", campaignId: "c_np", platform: "meta", name: "4.7★ from 212 neighbors", status: "active", spend: 96, results: 2, impressions: 9800, clicks: 131, frequency: 1.6, ctrTrend: [1.3, 1.3, 1.4, 1.3, 1.4, 1.3, 1.3], startedDaysAgo: 30,
    copy: { angle: "proof", format: "image", headline: "“First dentist I don't dread.”", text: "212 reviews, 4.7 stars, and a team that explains before it drills. Book online in two minutes.", hue: 45 } }),
  ad({ id: "a_drpatel", parentId: "s_mueller", campaignId: "c_np", platform: "meta", name: "Meet Dr. Patel (video)", status: "active", spend: 214, results: 1, impressions: 21400, clicks: 120, frequency: 2.4, ctrTrend: [0.7, 0.6, 0.6, 0.5, 0.6, 0.5, 0.5], startedDaysAgo: 9,
    copy: { angle: "authority", format: "video", headline: "Hi, I'm Dr. Patel.", text: "Twenty seconds on why we show you the X-ray before we suggest anything.", hue: 265 } }),

  { id: "c_inv", level: "campaign", campaignId: "c_inv", platform: "meta", name: "Invisalign consult", status: "active", budget: 30, spend: 0, results: 0, impressions: 0, clicks: 0, ctrTrend: [], startedDaysAgo: 22 },
  { id: "s_inv", level: "adset", parentId: "c_inv", campaignId: "c_inv", platform: "meta", name: "Austin · 22–45", status: "active", spend: 0, results: 0, impressions: 0, clicks: 0, ctrTrend: [], startedDaysAgo: 22 },
  ad({ id: "a_free", parentId: "s_inv", campaignId: "c_inv", platform: "meta", name: "Free consult in November", status: "active", spend: 142, results: 3, impressions: 12100, clicks: 170, frequency: 2.1, ctrTrend: [1.3, 1.4, 1.4, 1.4, 1.5, 1.4, 1.4], startedDaysAgo: 22,
    copy: { angle: "deadline", format: "carousel", headline: "Free Invisalign consult, November only", text: "See your new smile on screen before you decide. Free through November 30 at both locations.", hue: 0 } }),
  ad({ id: "a_summer", parentId: "s_inv", campaignId: "c_inv", platform: "meta", name: "Straighter by summer", status: "active", spend: 38, results: 0, impressions: 3900, clicks: 41, frequency: 1.2, ctrTrend: [1.0, 1.1, 1.0, 1.1], startedDaysAgo: 4,
    copy: { angle: "deadline", format: "image", headline: "Start now, straighter by summer", text: "Most Invisalign cases take 6 to 9 months. Start in November and you're done before pool season.", hue: 0 } }),

  { id: "c_emerg", level: "campaign", campaignId: "c_emerg", platform: "google", name: "Emergency dentist · Search", status: "active", budget: 40, spend: 0, results: 0, impressions: 0, clicks: 0, ctrTrend: [], limitedBy: 34, startedDaysAgo: 96,
    wasteTerms: ["emergency dentist jobs", "dental assistant salary", "free dental clinic", "emergency vet austin", "dentist open sunday san antonio", "how to stop tooth pain at home", "tooth pain reddit", "dental school clinic", "medicaid dentist"] },
  { id: "s_emerg", level: "adset", parentId: "c_emerg", campaignId: "c_emerg", platform: "google", name: "emergency dentist", status: "active", spend: 0, results: 0, impressions: 0, clicks: 0, ctrTrend: [], startedDaysAgo: 96 },
  ad({ id: "a_emerg", parentId: "s_emerg", campaignId: "c_emerg", platform: "google", name: "Same-day emergency dentist", status: "active", spend: 236, results: 7, impressions: 3100, clicks: 288, ctrTrend: [9.0, 9.4, 9.1, 9.6, 9.3, 9.2, 9.5], startedDaysAgo: 96,
    copy: { angle: "pain", format: "search", headline: "Emergency Dentist Austin | Seen Today | Call by Noon", text: "Same-day slots every weekday at South Congress and Mueller. Prices shared before we start.", hue: 18 } }),
  { id: "s_tooth", level: "adset", parentId: "c_emerg", campaignId: "c_emerg", platform: "google", name: "toothache", status: "active", spend: 0, results: 0, impressions: 0, clicks: 0, ctrTrend: [], startedDaysAgo: 96 },
  ad({ id: "a_tooth", parentId: "s_tooth", campaignId: "c_emerg", platform: "google", name: "Toothache? Same-day visit", status: "active", spend: 44, results: 1, impressions: 1240, clicks: 71, ctrTrend: [5.6, 5.8, 5.5, 5.9, 5.7, 5.6, 5.8], startedDaysAgo: 96,
    copy: { angle: "pain", format: "search", headline: "Toothache? Same-Day Dentist | South Austin", text: "Call by noon and we'll see you today. Open early weekdays and Saturdays.", hue: 18 } }),

  { id: "c_invs", level: "campaign", campaignId: "c_invs", platform: "google", name: "Invisalign · Search", status: "active", budget: 35, spend: 0, results: 0, impressions: 0, clicks: 0, ctrTrend: [], startedDaysAgo: 60 },
  { id: "s_invs", level: "adset", parentId: "c_invs", campaignId: "c_invs", platform: "google", name: "invisalign austin", status: "active", spend: 0, results: 0, impressions: 0, clicks: 0, ctrTrend: [], startedDaysAgo: 60 },
  ad({ id: "a_invs", parentId: "s_invs", campaignId: "c_invs", platform: "google", name: "Invisalign in Austin, free consult", status: "active", spend: 238, results: 2, impressions: 2700, clicks: 96, ctrTrend: [3.8, 3.6, 3.7, 3.5, 3.6, 3.4, 3.5], startedDaysAgo: 60,
    copy: { angle: "deadline", format: "search", headline: "Invisalign Austin | Free Consult in November", text: "See your results on screen before you decide. Two locations, Saturday hours.", hue: 0 } }),

  { id: "c_brand", level: "campaign", campaignId: "c_brand", platform: "google", name: "Brand · Search", status: "active", budget: 8, spend: 0, results: 0, impressions: 0, clicks: 0, ctrTrend: [], startedDaysAgo: 210 },
  { id: "s_brand", level: "adset", parentId: "c_brand", campaignId: "c_brand", platform: "google", name: "maple and main dental", status: "active", spend: 0, results: 0, impressions: 0, clicks: 0, ctrTrend: [], startedDaysAgo: 210 },
  ad({ id: "a_brand", parentId: "s_brand", campaignId: "c_brand", platform: "google", name: "Maple & Main Dental, official site", status: "active", spend: 41, results: 2, impressions: 610, clicks: 122, ctrTrend: [20.1, 19.6, 20.4, 20.0, 19.8, 20.2, 20.0], startedDaysAgo: 210,
    copy: { angle: "convenience", format: "search", headline: "Maple & Main Dental | Book Online | Saturday Hours", text: "Family and cosmetic dentistry at South Congress and Mueller. New patients welcome.", hue: 200 } }),
];

/** Cost per result for the goal, weekly, oldest first. The last point is this week. */
export const goalHistory = { labels: ["Sep 8", "Sep 15", "Sep 22", "Sep 29", "Oct 6", "Oct 13", "Oct 20", "Oct 27"], cost: [94, 88, 81, 77, 70, 66, 63, 0] };

// ---------- Other advertisers' ads ----------

export type LibraryAd = {
  id: string;
  advertiser: string;
  competitor?: boolean; // one of your tracked competitors
  platform: AdPlatform;
  format: Format;
  angle: Angle;
  days: number; // days running
  active: boolean;
  versions: number; // how many versions of this ad the advertiser keeps live
  headline: string;
  text: string;
  cta: string;
  offer?: string;
  landing: string;
  why: string; // Marko's read on why it works
  yours: string; // how it could sound for you
};

export const library: LibraryAd[] = [
  { id: "l1", advertiser: "Bright Smile Austin", competitor: true, platform: "meta", format: "image", angle: "price", days: 186, active: true, versions: 9, headline: "$99 exam, X-rays & cleaning", text: "New patients only. No insurance needed. Book online in 60 seconds, Saturday spots open.", cta: "Book now", offer: "$99 new patient special", landing: "brightsmileatx.com/new-patient", why: "Running six months with nine live versions: they keep paying for it, so it books. The price is the headline, and the fine print answers the next two questions (insurance, when).", yours: "Lead with $129 and what's included. Yours includes the cleaning they charge extra for elsewhere, so say “the whole price”." },
  { id: "l2", advertiser: "Bright Smile Austin", competitor: true, platform: "meta", format: "video", angle: "proof", days: 94, active: true, versions: 4, headline: "Real patients, real reasons", text: "“I hadn't been to a dentist in 8 years.” Hear why Austin switched to Bright Smile.", cta: "Learn more", landing: "brightsmileatx.com/reviews", why: "Phone-shot patient clips; the opening line names the fear (years since the last visit) instead of the service.", yours: "Ask two patients who came back after a long gap to film 15 seconds. Open on “It had been six years…”" },
  { id: "l3", advertiser: "Congress Ave Dental", competitor: true, platform: "google", format: "search", angle: "pain", days: 312, active: true, versions: 6, headline: "Emergency Dentist Near You | Open Today", text: "Walk-ins welcome. Most insurance accepted. Call now for same-day relief.", cta: "Call", landing: "congressavedental.com/emergency", why: "On for nearly a year with call extensions: emergency searches convert on the phone, and the headline answers “are you open now?”.", yours: "You already run this; test “Call by noon, seen today” as a headline. It's more specific than “Open today”." },
  { id: "l4", advertiser: "Lone Star Dental Group", platform: "meta", format: "carousel", angle: "deadline", days: 61, active: true, versions: 12, headline: "Your benefits reset Dec 31", text: "Most plans cover two cleanings a year. Use what you've paid for before it's gone.", cta: "Book now", offer: "Use your benefits", landing: "lonestardental.com/benefits", why: "A chain runs 12 versions every Q4: the deadline is real, it's free money for the patient, and it lands when people are thinking about year-end.", yours: "“You've paid for two cleanings this year. Have you used them?” Run Nov 1 to Dec 20, pointing at online booking." },
  { id: "l5", advertiser: "Lone Star Dental Group", platform: "tiktok", format: "video", angle: "authority", days: 38, active: true, versions: 3, headline: "Dentist reacts: flossing hacks", text: "Our hygienist rates TikTok's flossing hacks so you don't have to.", cta: "Learn more", landing: "lonestardental.com", why: "Entertainment first, ad second. Reaction videos borrow attention from a trend people already watch.", yours: "Dr. Patel rates three viral whitening hacks in 20 seconds. End on: “Want it done safely? Saturday slots.”" },
  { id: "l6", advertiser: "Hill Country Smiles", platform: "meta", format: "image", angle: "convenience", days: 47, active: true, versions: 5, headline: "Open at 7am. Back at your desk by 8:30.", text: "Early appointments every weekday, so a checkup doesn't cost you a morning.", cta: "Book now", landing: "hillcountrysmiles.com", why: "Speaks to the real objection for working adults (time off), with a picture of the outcome, not the service.", yours: "You open at 7:30 too. “Cleaning before work, done by 8:30. South Congress & Mueller.”" },
  { id: "l7", advertiser: "SmileWorks Ortho", platform: "meta", format: "video", angle: "compare", days: 122, active: true, versions: 7, headline: "Mail-order aligners vs. us", text: "Same price as the mail-order kits, with an orthodontist checking every step.", cta: "Get quote", offer: "Price match", landing: "smileworksortho.com/compare", why: "Names the cheaper alternative people are already weighing and removes the price gap.", yours: "“Invisalign with a dentist who checks every tray. Free consult in November.”" },
  { id: "l8", advertiser: "Congress Ave Dental", competitor: true, platform: "meta", format: "image", angle: "price", days: 12, active: true, versions: 2, headline: "Whitening $199 this month", text: "Professional whitening, one visit. Book before Nov 30.", cta: "Book now", offer: "$199 whitening", landing: "congressavedental.com/whitening", why: "New, so no verdict yet. Watch it: if it's still live in three weeks, the price works.", yours: "Hold off until it proves itself. If it does, answer with a whitening offer that includes a cleaning." },
  { id: "l9", advertiser: "Bright Smile Austin", competitor: true, platform: "google", format: "search", angle: "compare", days: 140, active: true, versions: 3, headline: "Maple & Main Alternative | Same-Day Visits", text: "Switch to Bright Smile. $99 new patient exam. 538 five-star reviews.", cta: "Book", offer: "$99 new patient special", landing: "brightsmileatx.com", why: "They're bidding on your name. It runs because people searching for you are ready to book.", yours: "Keep your Brand campaign on; it costs about $1 a click and stops them taking those patients." },
  { id: "l10", advertiser: "Austin Family Dentistry", platform: "meta", format: "image", angle: "proof", days: 9, active: false, versions: 1, headline: "Voted Best Dentist 2026", text: "Thanks for voting us Austin's favorite family dentist.", cta: "Learn more", landing: "austinfamilydentistry.com", why: "Stopped after nine days with one version: awards rarely make people book.", yours: "Skip. Real patient words beat a badge." },
  { id: "l11", advertiser: "Hill Country Smiles", platform: "tiktok", format: "video", angle: "pain", days: 33, active: true, versions: 4, headline: "POV: you cracked a tooth on a tortilla chip", text: "We see emergencies same day. Don't wait it out.", cta: "Book now", landing: "hillcountrysmiles.com/emergency", why: "A local, slightly funny scene everyone recognizes, and the fix in one line.", yours: "“POV: breakfast taco, then a crunch.” Same-day slots at South Congress." },
  { id: "l12", advertiser: "Lone Star Dental Group", platform: "google", format: "search", angle: "price", days: 230, active: true, versions: 8, headline: "Dentist Austin | $59 New Patient Exam", text: "Exam + X-rays $59. Cleanings extra. 14 Austin locations.", cta: "Book", offer: "$59 exam", landing: "lonestardental.com/specials", why: "Cheapest headline in the market, but cleaning is extra. People comparing will see it.", yours: "Don't race to $59. “$129, cleaning included” wins the people who read the fine print." },
];

/** Searches people run here, and the advertisers you compete with. */
export const researchStarters = ["dentist austin", "emergency dentist", "invisalign", "Bright Smile Austin", "Congress Ave Dental"];
export const watchedAdvertisers = ["Bright Smile Austin", "Congress Ave Dental"];

// ---------- Copy bank for the studio ----------
// Real build: Claude writes these per brief with the brand voice; the mock
// picks from a few per angle so variations differ.

export const copyBank: Record<Angle, { hooks: string[]; texts: string[]; search: string[] }> = {
  price: {
    hooks: ["New patient visit, $129. That's the whole price.", "Know the price before you sit down", "$129 with the cleaning. Not $59 plus extras.", "No insurance? $129 covers your first visit", "What a checkup costs here: $129"],
    texts: ["Exam, X-rays and cleaning for $129 without insurance. Every price is shared before we start.", "Most places quote the exam and add the cleaning later. Ours is one price: $129, all in.", "You'll see the price on screen before anything happens. Book online at South Congress or Mueller."],
    search: ["$129 New Patient Visit | Cleaning Included", "Dentist Austin | Prices Shared Upfront", "No Insurance? $129 First Visit"],
  },
  pain: {
    hooks: ["Toothache can't wait. Neither do we.", "Call by noon, seen today", "Cracked it on a taco? Same-day slots.", "Lost a filling this morning? Come in this afternoon.", "Same-day emergency visits in South Austin"],
    texts: ["Same-day emergency slots every weekday at South Congress and Mueller. Call by noon and we'll see you today.", "We keep two emergency slots open every weekday. Most people are out within an hour.", "Open 7:30 weekdays and Saturday mornings, so a bad tooth doesn't ruin the weekend."],
    search: ["Emergency Dentist Austin | Seen Today", "Toothache? Call by Noon, Seen Today", "Same-Day Dentist | South Congress & Mueller"],
  },
  proof: {
    hooks: ["“First dentist I don't dread.”", "212 neighbors, 4.7 stars", "“They showed me the X-ray before suggesting anything.”", "“Six years since my last cleaning. Zero lectures.”", "Why Austin families switch to us"],
    texts: ["212 reviews, 4.7 stars, and a team that explains before it drills. Book online in two minutes.", "Patients mention the same three things: no lectures, prices upfront, and they actually run on time.", "Read what 212 neighbors say, then book at the location closest to you."],
    search: ["4.7★ from 212 Patients | Austin Dentist", "Rated 4.7 by Austin Families", "No Lectures, Just Good Care"],
  },
  convenience: {
    hooks: ["Cleaning before work. Done by 8:30.", "Saturday appointments, every week", "Two locations, book online in 2 minutes", "Your lunch break is long enough", "Kids and parents, same visit"],
    texts: ["Open 7:30 weekdays and Saturday mornings at South Congress and Mueller. Book online, no phone tag.", "Book the whole family back to back, so it's one trip instead of four.", "Pick a time online, get a text reminder, and be in the chair on time."],
    search: ["Saturday Dentist Austin | Book Online", "Early Appointments from 7:30am", "Family Dentist | 2 Austin Locations"],
  },
  authority: {
    hooks: ["Hi, I'm Dr. Patel. 20 seconds on X-rays.", "A dentist explains: do you really need that crown?", "What I check first at every cleaning", "The one habit I'd change for your teeth", "Dentist rates 3 viral whitening hacks"],
    texts: ["Dr. Patel explains one thing clearly in every video. No jargon, no scare tactics.", "We show you the X-ray and explain it before we suggest anything. Here's why.", "Fifteen years of family dentistry in Austin, explained in 20 seconds."],
    search: ["Dr. Anika Patel | Family Dentist Austin", "A Dentist Who Explains First", "15 Years Caring for Austin Families"],
  },
  compare: {
    hooks: ["Same dentist every visit. Not a chain.", "No upsell. Ask anyone who's been.", "Invisalign with a dentist checking every tray", "Mail-order aligners vs. a dentist you can see", "A neighborhood dentist, not a call center"],
    texts: ["You'll see the same dentist each time, and we'll never push treatment you don't need.", "Every tray checked in person by Dr. Patel, for about what the mail-order kits cost.", "Small on purpose: two neighborhood offices and a team that knows your name."],
    search: ["Local Dentist, Not a Chain | Austin", "Invisalign Checked by a Dentist", "Same Dentist Every Visit"],
  },
  deadline: {
    hooks: ["Your dental benefits reset December 31", "You've paid for two cleanings. Used them?", "Free Invisalign consult, November only", "Start now, straighter by summer", "Book before the holidays fill up"],
    texts: ["Most plans cover two cleanings a year and don't roll over. Use what you've paid for before Dec 31.", "Free Invisalign consult through November 30 at both locations. See your new smile on screen first.", "December fills fast. Pick a time online now and keep your benefits."],
    search: ["Use Your Dental Benefits by Dec 31", "Free Invisalign Consult | November", "Book Before Your Benefits Reset"],
  },
};

export const ctas = ["Book now", "Call now", "Learn more", "Get quote", "Get offer"];
export const brandName = business.name;

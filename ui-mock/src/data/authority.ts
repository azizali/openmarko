// Citations (where the business is listed online, and whether the details
// match) and backlinks (sites that link to it). Mock data for Maple & Main.
//
// Real build:
// - Citation tracking: one Google search per directory for the business name
//   + phone (DataForSEO SERP, site:domain), then parse the listing page
//   (On-Page content_parsing) and compare name, address, phone, hours, URL.
// - Citation building: aggregator + manual submissions through a partner
//   (e.g. BrightLocal or Whitespark citation services); Google, Apple and
//   Bing directly through their own APIs.
// - Backlinks: DataForSEO Backlinks API (summary, referring_domains,
//   backlinks, domain_intersection for the competitor gap, new/lost history).

import { competitors } from "./mock";

export type CitationStatus = "correct" | "wrong" | "missing" | "duplicate";
export type BuildMethod = "Direct API" | "Aggregator" | "Partner submission" | "Claim it yourself";
export type Citation = {
  id: string;
  site: string;
  domain: string;
  kind: "Core" | "Data aggregator" | "Healthcare" | "Local" | "Social";
  authority: number; // 0–100
  status: CitationStatus;
  issue?: string;
  rivalsListed: number; // of 5 tracked competitors
  aiCited: boolean; // AI answers cite this site for local picks
  method: BuildMethod;
  cost: number; // to build or fix, USD
};

export const citations: Citation[] = [
  { id: "google", site: "Google Business Profile", domain: "google.com", kind: "Core", authority: 100, status: "correct", rivalsListed: 5, aiCited: true, method: "Direct API", cost: 0 },
  { id: "apple", site: "Apple Business Connect", domain: "maps.apple.com", kind: "Core", authority: 96, status: "wrong", issue: "Hours missing Saturday", rivalsListed: 4, aiCited: false, method: "Direct API", cost: 0 },
  { id: "bing", site: "Bing Places", domain: "bing.com/maps", kind: "Core", authority: 92, status: "correct", rivalsListed: 4, aiCited: false, method: "Direct API", cost: 0 },
  { id: "yelp", site: "Yelp", domain: "yelp.com", kind: "Core", authority: 94, status: "wrong", issue: "Old address: Suite 200 (moved to 1204)", rivalsListed: 5, aiCited: true, method: "Claim it yourself", cost: 0 },
  { id: "facebook", site: "Facebook", domain: "facebook.com", kind: "Social", authority: 98, status: "correct", rivalsListed: 5, aiCited: false, method: "Claim it yourself", cost: 0 },
  { id: "bbb", site: "Better Business Bureau", domain: "bbb.org", kind: "Core", authority: 88, status: "correct", rivalsListed: 3, aiCited: true, method: "Claim it yourself", cost: 0 },
  { id: "healthgrades", site: "Healthgrades", domain: "healthgrades.com", kind: "Healthcare", authority: 87, status: "missing", rivalsListed: 4, aiCited: true, method: "Partner submission", cost: 3 },
  { id: "zocdoc", site: "Zocdoc", domain: "zocdoc.com", kind: "Healthcare", authority: 84, status: "missing", rivalsListed: 3, aiCited: true, method: "Claim it yourself", cost: 0 },
  { id: "webmd", site: "WebMD Care", domain: "doctor.webmd.com", kind: "Healthcare", authority: 86, status: "wrong", issue: "Phone is the old (512) 555-0199", rivalsListed: 3, aiCited: false, method: "Partner submission", cost: 3 },
  { id: "dataaxle", site: "Data Axle", domain: "data-axle.com", kind: "Data aggregator", authority: 70, status: "correct", rivalsListed: 4, aiCited: false, method: "Aggregator", cost: 0 },
  { id: "foursquare", site: "Foursquare", domain: "foursquare.com", kind: "Data aggregator", authority: 82, status: "wrong", issue: "Name listed as “Maple and Main Dentistry”", rivalsListed: 4, aiCited: false, method: "Aggregator", cost: 3 },
  { id: "localeze", site: "Neustar Localeze", domain: "neustarlocaleze.biz", kind: "Data aggregator", authority: 65, status: "missing", rivalsListed: 3, aiCited: false, method: "Aggregator", cost: 3 },
  { id: "nextdoor", site: "Nextdoor", domain: "nextdoor.com", kind: "Local", authority: 85, status: "missing", rivalsListed: 2, aiCited: true, method: "Claim it yourself", cost: 0 },
  { id: "yp", site: "Yellow Pages", domain: "yellowpages.com", kind: "Core", authority: 80, status: "duplicate", issue: "2 listings: one with the old phone", rivalsListed: 5, aiCited: false, method: "Partner submission", cost: 3 },
  { id: "mapquest", site: "MapQuest", domain: "mapquest.com", kind: "Core", authority: 78, status: "correct", rivalsListed: 4, aiCited: false, method: "Aggregator", cost: 0 },
  { id: "chamber", site: "Austin Chamber of Commerce", domain: "austinchamber.com", kind: "Local", authority: 62, status: "missing", rivalsListed: 2, aiCited: false, method: "Claim it yourself", cost: 0 },
  { id: "ada", site: "ADA Find-a-Dentist", domain: "findadentist.ada.org", kind: "Healthcare", authority: 76, status: "correct", rivalsListed: 4, aiCited: false, method: "Claim it yourself", cost: 0 },
  { id: "manta", site: "Manta", domain: "manta.com", kind: "Core", authority: 66, status: "missing", rivalsListed: 3, aiCited: false, method: "Partner submission", cost: 3 },
];

export const citationStatusMeta: Record<CitationStatus, { label: string; tone: "good" | "bad" | "warn" | "info" }> = {
  correct: { label: "Correct", tone: "good" },
  wrong: { label: "Wrong info", tone: "warn" },
  missing: { label: "Missing", tone: "bad" },
  duplicate: { label: "Duplicate", tone: "info" },
};

export function citationScore(list = citations) {
  const weight = (c: Citation) => c.authority;
  const total = list.reduce((a, c) => a + weight(c), 0);
  const good = list.filter((c) => c.status === "correct").reduce((a, c) => a + weight(c), 0);
  return Math.round((good / total) * 100);
}

// ---------- Backlinks ----------

const leader = competitors.find((c) => c.id === "c1")!;

export const linkSummary = {
  you: { refDomains: 38, backlinks: 184, localDomains: 2, new30: 4, lost30: 1, rank: 212 },
  leader: { name: leader.name, refDomains: 104, backlinks: leader.backlinks, localDomains: 17 },
  avgTop3RefDomains: 71,
};

const months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
export const linkHistory = {
  labels: months,
  you: [31, 32, 34, 35, 35, 38],
  leader: [88, 91, 95, 98, 101, 104],
  top3: [60, 62, 65, 67, 69, 71],
};

export type LinkType = "Local news" | "Chamber & associations" | "Sponsorship" | "Supplier / partner" | "Directory" | "Blog / resource" | "Unlinked mention";
export type LinkStatus = "idea" | "outreach" | "won" | "lost";
export type LinkOpportunity = {
  id: string;
  domain: string;
  type: LinkType;
  authority: number;
  linksTo: string[]; // competitors this site already links to
  how: string;
  contact: string;
  status: LinkStatus;
  local: boolean;
};

export const linkOpportunities: LinkOpportunity[] = [
  { id: "l1", domain: "austinchamber.com", type: "Chamber & associations", authority: 62, linksTo: ["Bright Smile Austin", "Congress Ave Dental", "South Lamar Dental Studio"], how: "Join the chamber ($395/yr). Members get a profile page with a followed link.", contact: "membership@austinchamber.com", status: "idea", local: true },
  { id: "l2", domain: "kxan.com", type: "Local news", authority: 81, linksTo: ["Bright Smile Austin"], how: "Pitch a seasonal story: “Halloween candy and kids' teeth, from a 78704 dentist”. Local TV sites link to expert sources.", contact: "newsdesk@kxan.com", status: "idea", local: true },
  { id: "l3", domain: "southaustinlittleleague.org", type: "Sponsorship", authority: 34, linksTo: ["Barton Creek Family Dentistry", "Bright Smile Austin"], how: "Sponsor a team for the spring season (~$300). Sponsors are listed with a link.", contact: "board@southaustinlittleleague.org", status: "outreach", local: true },
  { id: "l4", domain: "invisalign.com", type: "Supplier / partner", authority: 78, linksTo: ["Bright Smile Austin", "South Lamar Dental Studio"], how: "You're a certified provider. Ask your rep to add your practice to the Invisalign doctor locator with your website.", contact: "Invisalign rep", status: "idea", local: false },
  { id: "l5", domain: "austinmonthly.com", type: "Blog / resource", authority: 72, linksTo: ["Bright Smile Austin", "Congress Ave Dental"], how: "Their yearly “Top Dentists” list cites peer nominations. Ask patients and peers to nominate before the deadline. AI answers cite this list.", contact: "editor@austinmonthly.com", status: "idea", local: true },
  { id: "l6", domain: "soco-austin.com", type: "Directory", authority: 41, linksTo: ["Congress Ave Dental", "South Lamar Dental Studio", "Zilker Dental Co."], how: "Free listing in the South Congress merchants' directory.", contact: "hello@soco-austin.com", status: "won", local: true },
  { id: "l7", domain: "austin.culturemap.com", type: "Unlinked mention", authority: 74, linksTo: [], how: "Mentioned you in a 2025 article without a link. Ask them to add one.", contact: "tips@culturemap.com", status: "idea", local: true },
  { id: "l8", domain: "utexas.edu", type: "Blog / resource", authority: 92, linksTo: ["Congress Ave Dental"], how: "UT's student health page lists nearby dentists that take student insurance. Ask to be added if you accept it.", contact: "healthyhorns@utexas.edu", status: "idea", local: true },
  { id: "l9", domain: "deltadentalins.com", type: "Supplier / partner", authority: 76, linksTo: ["Bright Smile Austin", "Congress Ave Dental", "Barton Creek Family Dentistry"], how: "In-network provider search links to practice websites. Check your provider record has the URL.", contact: "Provider relations", status: "lost", local: false },
];

export type Backlink = { domain: string; anchor: string; authority: number; firstSeen: string; follow: boolean; state: "new" | "lost" | "live"; local: boolean };
export const backlinks: Backlink[] = [
  { domain: "soco-austin.com", anchor: "Maple & Main Dental", authority: 41, firstSeen: "Oct 21", follow: true, state: "new", local: true },
  { domain: "yelp.com", anchor: "mapleandmaindental.com", authority: 94, firstSeen: "Oct 12", follow: false, state: "new", local: false },
  { domain: "austinmomsblog.com", anchor: "our kids' dentist", authority: 38, firstSeen: "Oct 8", follow: true, state: "new", local: true },
  { domain: "findadentist.ada.org", anchor: "Website", authority: 76, firstSeen: "Oct 2", follow: false, state: "new", local: false },
  { domain: "oldtownpediatrics.com", anchor: "dentist referral", authority: 29, firstSeen: "Jun 14", follow: true, state: "lost", local: true },
  { domain: "bbb.org", anchor: "Visit website", authority: 88, firstSeen: "Mar 3, 2024", follow: false, state: "live", local: false },
  { domain: "facebook.com", anchor: "mapleandmaindental.com", authority: 98, firstSeen: "Jan 9, 2023", follow: false, state: "live", local: false },
  { domain: "dentaltown.com", anchor: "Dr. Patel", authority: 58, firstSeen: "Aug 22, 2024", follow: true, state: "live", local: false },
];

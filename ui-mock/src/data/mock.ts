// Deterministic mock data. Every shape here mirrors what the real service
// layer in src/lib/api.ts will return, so pages can be wired up later
// without changing components.

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export const business = {
  name: "Maple & Main Dental",
  category: "Dentist",
  address: "1204 S Congress Ave, Austin, TX 78704",
  phone: "(512) 555-0142",
  website: "mapleandmaindental.com",
  rating: 4.7,
  reviews: 212,
  placeId: "ChIJ0X1b8Ny0RIYR2mQ4",
  lat: 30.2509,
  lng: -97.7497,
};

/** Prospecting is an Agency-plan feature; a Local-plan workspace never sees it. */
export const workspace = { plan: "agency" as "local" | "agency" };

export const locations = [
  { id: "loc_1", name: "Maple & Main — South Congress", city: "Austin, TX" },
  { id: "loc_2", name: "Maple & Main — Mueller", city: "Austin, TX" },
];

// ---------- Rankings ----------

export type Keyword = {
  id: string;
  term: string;
  volume: number;
  kd: number;
  intent: "transactional" | "commercial" | "informational" | "navigational";
  organic: number | null;
  organicPrev: number | null;
  local: number | null; // map pack position (1–3 is "in pack"), up to 20
  localPrev: number | null;
  best: number;
  url: string;
  serpFeatures: string[];
  history: { date: string; organic: number | null; local: number | null }[];
  tags: string[];
};

const terms: [string, number, number, Keyword["intent"], string[]][] = [
  ["dentist austin", 6600, 48, "transactional", ["core"]],
  ["dentist near me", 49500, 62, "transactional", ["core"]],
  ["emergency dentist austin", 1900, 34, "transactional", ["emergency"]],
  ["teeth whitening austin", 1300, 29, "commercial", ["cosmetic"]],
  ["invisalign austin", 2400, 41, "commercial", ["cosmetic"]],
  ["pediatric dentist south austin", 720, 22, "transactional", ["family"]],
  ["dental implants austin", 1600, 52, "commercial", ["implants"]],
  ["cosmetic dentist austin", 880, 38, "commercial", ["cosmetic"]],
  ["dentist 78704", 390, 14, "transactional", ["core"]],
  ["root canal austin", 590, 27, "transactional", ["emergency"]],
  ["best dentist south congress", 260, 12, "commercial", ["core"]],
  ["dental cleaning austin", 480, 19, "transactional", ["core"]],
  ["veneers austin", 720, 36, "commercial", ["cosmetic"]],
  ["wisdom teeth removal austin", 1000, 33, "transactional", ["surgery"]],
  ["sedation dentistry austin", 320, 24, "commercial", ["surgery"]],
  ["how much is a dental cleaning without insurance", 2900, 18, "informational", ["content"]],
];

function makeHistory(r: () => number, endOrganic: number | null, endLocal: number | null) {
  const out: Keyword["history"] = [];
  const days = 90;
  let o = endOrganic ? Math.min(60, endOrganic + Math.round(r() * 14) + 2) : null;
  let l = endLocal ? Math.min(20, endLocal + Math.round(r() * 6) + 1) : null;
  for (let i = days; i >= 0; i -= 3) {
    const d = new Date(2026, 9, 29);
    d.setDate(d.getDate() - i);
    if (o !== null && endOrganic !== null) o = Math.max(1, Math.round(o + (endOrganic - o) * 0.12 + (r() - 0.5) * 2.4));
    if (l !== null && endLocal !== null) l = Math.max(1, Math.round(l + (endLocal - l) * 0.15 + (r() - 0.5) * 1.6));
    out.push({ date: d.toISOString().slice(0, 10), organic: o, local: l });
  }
  if (out.length) {
    out[out.length - 1].organic = endOrganic;
    out[out.length - 1].local = endLocal;
  }
  return out;
}

export const keywords: Keyword[] = terms.map(([term, volume, kd, intent, tags], i) => {
  const r = rng(i + 7);
  const organic = i === 15 ? 14 : Math.max(1, Math.round(r() * 18) + (i % 4 === 0 ? 1 : 3));
  const local = intent === "informational" ? null : Math.max(1, Math.round(r() * 9) + (i % 3));
  const move = Math.round((r() - 0.35) * 8);
  const lmove = local ? Math.round((r() - 0.4) * 4) : 0;
  return {
    id: `kw_${i + 1}`,
    term,
    volume,
    kd,
    intent,
    organic,
    organicPrev: Math.max(1, organic + move),
    local,
    localPrev: local ? Math.max(1, local + lmove) : null,
    best: Math.max(1, organic - Math.round(r() * 3)),
    url: ["/", "/emergency", "/cosmetic/whitening", "/cosmetic/invisalign", "/family", "/implants"][i % 6],
    serpFeatures: ["Local pack", "People also ask", "Reviews", "Images", "Sitelinks"].filter(() => r() > 0.45),
    history: makeHistory(r, organic, local),
    tags,
  };
});

// ---------- Rank pack / geo-grid ----------

export type GridPoint = { row: number; col: number; rank: number | null; top3: string[] };
export type GridScan = {
  id: string;
  keywordId: string;
  date: string;
  size: number;
  radiusMi: number;
  points: GridPoint[];
};

export const competitorNames = [
  "Bright Smile Austin",
  "Congress Ave Dental",
  "Barton Creek Family Dentistry",
  "South Lamar Dental Studio",
  "Zilker Dental Co.",
];

export function makeGrid(keywordId: string, size = 7, seed = 1, bias = 0): GridScan {
  const r = rng(seed * 31 + keywordId.length * 7);
  const c = (size - 1) / 2;
  const points: GridPoint[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      // Ranks get worse with distance from the pin, skewed north-east.
      const dist = Math.hypot(row - c, col - c) + (col > c ? 0.6 : 0) + (row < c ? 0.4 : 0);
      const base = 1 + dist * 2.3 + r() * 3 - bias;
      const rank = base > 20 ? null : Math.max(1, Math.round(base));
      const shuffled = [...competitorNames].sort(() => r() - 0.5);
      const top3 =
        rank && rank <= 3
          ? [...shuffled.slice(0, rank - 1), business.name, ...shuffled.slice(rank - 1)].slice(0, 3)
          : shuffled.slice(0, 3);
      points.push({ row, col, rank, top3 });
    }
  }
  return { id: `scan_${keywordId}_${seed}`, keywordId, date: seed === 1 ? "2026-10-28" : "2026-09-28", size, radiusMi: 3, points };
}

export function gridStats(scan: GridScan) {
  const ranked = scan.points.map((p) => p.rank ?? 21);
  const arp = ranked.reduce((a, b) => a + b, 0) / ranked.length;
  const found = scan.points.filter((p) => p.rank !== null);
  const atrp = found.reduce((a, p) => a + (p.rank ?? 0), 0) / Math.max(1, found.length);
  const solv = (scan.points.filter((p) => p.rank !== null && p.rank <= 3).length / scan.points.length) * 100;
  return { arp, atrp, solv, top3: scan.points.filter((p) => (p.rank ?? 99) <= 3).length, total: scan.points.length };
}

// ---------- Competitors ----------

export type Competitor = {
  id: string;
  name: string;
  isYou?: boolean;
  rating: number;
  reviews: number;
  reviewVelocity: number; // reviews / month
  photos: number;
  categories: string[];
  avgGridRank: number;
  solv: number;
  posts30d: number;
  domainRank: number;
  backlinks: number;
  distanceMi: number;
  website: string;
};

export const competitors: Competitor[] = [
  { id: "you", isYou: true, name: business.name, rating: 4.7, reviews: 212, reviewVelocity: 6, photos: 48, categories: ["Dentist", "Cosmetic dentist"], avgGridRank: 6.4, solv: 31, posts30d: 1, domainRank: 212, backlinks: 184, distanceMi: 0, website: business.website },
  { id: "c1", name: "Bright Smile Austin", rating: 4.9, reviews: 538, reviewVelocity: 14, photos: 126, categories: ["Dentist", "Cosmetic dentist", "Teeth whitening service", "Emergency dental service"], avgGridRank: 3.1, solv: 58, posts30d: 6, domainRank: 298, backlinks: 612, distanceMi: 0.8, website: "brightsmileatx.com" },
  { id: "c2", name: "Congress Ave Dental", rating: 4.8, reviews: 341, reviewVelocity: 9, photos: 74, categories: ["Dentist", "Dental clinic"], avgGridRank: 4.6, solv: 44, posts30d: 4, domainRank: 241, backlinks: 297, distanceMi: 0.4, website: "congressavedental.com" },
  { id: "c3", name: "Barton Creek Family Dentistry", rating: 4.6, reviews: 189, reviewVelocity: 4, photos: 39, categories: ["Dentist", "Pediatric dentist"], avgGridRank: 7.9, solv: 22, posts30d: 0, domainRank: 176, backlinks: 121, distanceMi: 1.9, website: "bartoncreekdds.com" },
  { id: "c4", name: "South Lamar Dental Studio", rating: 4.8, reviews: 267, reviewVelocity: 8, photos: 92, categories: ["Dentist", "Cosmetic dentist", "Dental implants periodontist"], avgGridRank: 5.2, solv: 37, posts30d: 3, domainRank: 203, backlinks: 240, distanceMi: 1.2, website: "southlamardental.com" },
  { id: "c5", name: "Zilker Dental Co.", rating: 4.5, reviews: 98, reviewVelocity: 3, photos: 21, categories: ["Dentist"], avgGridRank: 9.7, solv: 12, posts30d: 0, domainRank: 132, backlinks: 58, distanceMi: 1.5, website: "zilkerdental.co" },
];

// ---------- Ranking factors ----------

/** A competitor's geo-grid for a keyword: strong where they're based, weaker with distance. */
export function makeRivalGrid(keywordId: string, rival: Competitor, size = 7, seed = 1): GridScan {
  if (rival.isYou) return makeGrid(keywordId, size, seed, seed === 1 ? Number(keywordId.split("_")[1]) % 3 : (Number(keywordId.split("_")[1]) % 3) - 1.5);
  const idn = rival.id.charCodeAt(1);
  const kwn = Number(keywordId.split("_")[1]);
  const r = rng(seed * 53 + kwn * 11 + idn * 7);
  const c = (size - 1) / 2;
  const angle = (idn * 1.7) % (2 * Math.PI);
  const cells = Math.min(c, rival.distanceMi / (3 / c)); // grid radius is 3 mi
  const cx = c + Math.cos(angle) * cells, cy = c + Math.sin(angle) * cells;
  const shift = ((kwn * idn) % 5) - 2 + (seed === 1 ? 0 : 1.2);
  const others = [business.name, ...competitorNames.filter((n) => n !== rival.name)];
  const points: GridPoint[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const dist = Math.hypot(row - cy, col - cx);
      const base = rival.avgGridRank * 0.6 + dist * 1.05 + r() * 1.6 + shift * 0.3 - 2;
      const rank = base > 20 ? null : Math.max(1, Math.round(base));
      const shuffled = [...others].sort(() => r() - 0.5);
      const top3 = rank && rank <= 3 ? [...shuffled.slice(0, rank - 1), rival.name, ...shuffled.slice(rank - 1)].slice(0, 3) : shuffled.slice(0, 3);
      points.push({ row, col, rank, top3 });
    }
  }
  return { id: `scan_${keywordId}_${rival.id}_${seed}`, keywordId, date: seed === 1 ? "2026-10-28" : "2026-09-28", size, radiusMi: 3, points };
}

export type FactorStatus = "good" | "warn" | "bad";
export type Factor = { name: string; status: FactorStatus; detail: string; actionId?: string };
export type FactorGroup = { id: string; name: string; weight: number; score: number; summary: string; factors: Factor[] };

export const factorGroups: FactorGroup[] = [
  {
    id: "gbp", name: "Google Business Profile", weight: 32, score: 64,
    summary: "Primary category and proximity drive most map-pack visibility.",
    factors: [
      { name: "Primary category", status: "good", detail: "“Dentist” matches the top competitors." },
      { name: "Secondary categories", status: "bad", detail: "2 of 6 relevant categories used. Competitors average 3.4.", actionId: "a1" },
      { name: "Keywords in business description", status: "warn", detail: "Missing “emergency” and “Invisalign”.", actionId: "a3" },
      { name: "Services & products", status: "warn", detail: "8 services listed. Pack leaders list 20+.", actionId: "a6" },
      { name: "Photos", status: "warn", detail: "48 photos. Leader has 126; last upload 41 days ago." },
      { name: "Hours & attributes", status: "good", detail: "Complete, including holiday hours." },
      { name: "Posting cadence", status: "bad", detail: "1 post in 30 days. Leaders post weekly.", actionId: "a2" },
    ],
  },
  {
    id: "reviews", name: "Reviews", weight: 16, score: 58,
    summary: "Volume, velocity, recency and keyword-rich responses.",
    factors: [
      { name: "Average rating", status: "good", detail: "4.7 ★ — above category median (4.6)." },
      { name: "Review velocity", status: "bad", detail: "6/mo vs. leader 14/mo.", actionId: "a5" },
      { name: "Response rate", status: "warn", detail: "61% of reviews answered. 9 unanswered.", actionId: "a4" },
      { name: "Keywords in reviews", status: "warn", detail: "“emergency” appears in 2% of reviews." },
    ],
  },
  {
    id: "onpage", name: "On-page signals", weight: 19, score: 71,
    summary: "Landing page relevance, NAP, schema and titles.",
    factors: [
      { name: "City in title tags", status: "warn", detail: "5 service pages missing “Austin”.", actionId: "a7" },
      { name: "LocalBusiness schema", status: "bad", detail: "No Dentist JSON-LD on homepage.", actionId: "a8" },
      { name: "NAP on page", status: "good", detail: "Matches GBP exactly." },
      { name: "Service page depth", status: "warn", detail: "No dedicated emergency page content (>300 words)." },
    ],
  },
  {
    id: "links", name: "Links", weight: 11, score: 47,
    summary: "Local and topical authority of linking domains.",
    factors: [
      { name: "Referring domains", status: "warn", detail: "38 domains vs. leader 104." },
      { name: "Local links", status: "bad", detail: "2 links from Austin sites (chamber, sponsorships)." },
      { name: "Anchor diversity", status: "good", detail: "Natural distribution." },
    ],
  },
  {
    id: "citations", name: "Citations", weight: 7, score: 82,
    summary: "NAP consistency across directories and aggregators.",
    factors: [
      { name: "Core directories", status: "good", detail: "Yelp, Apple Maps, Bing Places, Healthgrades listed." },
      { name: "NAP inconsistencies", status: "warn", detail: "3 listings show old suite number “Ste 200”.", actionId: "a9" },
    ],
  },
  {
    id: "behavior", name: "Behavioral", weight: 8, score: 69,
    summary: "Clicks, calls and direction requests from GBP and Search.",
    factors: [
      { name: "GBP actions trend", status: "good", detail: "Calls +12% vs. last 30 days." },
      { name: "Organic CTR", status: "warn", detail: "2.1% avg CTR on page-1 queries (GSC)." },
    ],
  },
  {
    id: "personal", name: "Personalization & proximity", weight: 7, score: 50,
    summary: "Not directly controllable. Used to explain grid falloff.",
    factors: [{ name: "Distance to searcher", status: "warn", detail: "Visibility drops sharply >1.5 mi north-east." }],
  },
];

// ---------- Site audit ----------

export type Severity = "critical" | "warning" | "notice";
export type AuditIssue = {
  id: string;
  title: string;
  category: "Technical" | "On-page" | "Local" | "Performance" | "Content";
  severity: Severity;
  pages: string[];
  why: string;
  fix: string;
  autoFix?: { executor: "WordPress" | "GBP" | "Manual"; before: string; after: string };
};

export const auditSummary = { score: 74, prevScore: 68, pages: 46, crawled: "2026-10-28 06:12", duration: "2m 14s", lcp: 2.9, cls: 0.04, inp: 180 };

export const auditIssues: AuditIssue[] = [
  {
    id: "i1", title: "Missing LocalBusiness / Dentist schema", category: "Local", severity: "critical",
    pages: ["/"],
    why: "Structured data helps Google connect your site to your Business Profile and can enable rich results.",
    fix: "Add a Dentist JSON-LD block with name, address, phone, geo, hours and sameAs links.",
    autoFix: {
      executor: "WordPress",
      before: "<!-- no structured data -->",
      after: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Dentist",
  "name": "Maple & Main Dental",
  "telephone": "+1-512-555-0142",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "1204 S Congress Ave",
    "addressLocality": "Austin",
    "addressRegion": "TX",
    "postalCode": "78704"
  },
  "geo": { "@type": "GeoCoordinates", "latitude": 30.2509, "longitude": -97.7497 },
  "openingHours": "Mo-Fr 08:00-17:00",
  "sameAs": ["https://g.page/mapleandmaindental"]
}
</script>`,
    },
  },
  {
    id: "i2", title: "Title tags missing target city", category: "On-page", severity: "warning",
    pages: ["/emergency", "/cosmetic/whitening", "/cosmetic/invisalign", "/implants", "/family"],
    why: "City modifiers in titles reinforce local relevance for “service + city” queries.",
    fix: "Rewrite titles to “{Service} in Austin, TX | Maple & Main Dental”.",
    autoFix: { executor: "WordPress", before: "Emergency Dental Care | Maple & Main", after: "Emergency Dentist in Austin, TX | Maple & Main Dental" },
  },
  {
    id: "i3", title: "Largest Contentful Paint above 2.5s on mobile", category: "Performance", severity: "warning",
    pages: ["/", "/cosmetic/invisalign", "/implants"],
    why: "Slow pages lose visitors and weaken page experience signals.",
    fix: "Serve the hero image as AVIF at 1200px, preload it, and defer the chat widget script.",
  },
  {
    id: "i4", title: "Broken internal links (404)", category: "Technical", severity: "critical",
    pages: ["/blog/whitening-myths", "/about"],
    why: "Broken links waste crawl budget and frustrate patients.",
    fix: "Redirect /new-patients-form to /new-patients (301).",
    autoFix: { executor: "WordPress", before: "/new-patients-form → 404", after: "/new-patients-form → 301 → /new-patients" },
  },
  {
    id: "i5", title: "Thin content on service pages (<300 words)", category: "Content", severity: "warning",
    pages: ["/emergency", "/family"],
    why: "Pages with little content rarely rank for competitive service keywords.",
    fix: "Expand with FAQs, pricing guidance, insurance info and before/after photos.",
  },
  {
    id: "i6", title: "Images without alt text", category: "On-page", severity: "notice",
    pages: ["/", "/about", "/team", "/cosmetic/veneers"],
    why: "Alt text improves accessibility and image search visibility.",
    fix: "Generate descriptive alt text for 23 images.",
    autoFix: { executor: "WordPress", before: 'alt=""', after: 'alt="Dr. Patel consulting a patient at Maple & Main Dental in Austin"' },
  },
  {
    id: "i7", title: "Duplicate meta descriptions", category: "On-page", severity: "notice",
    pages: ["/cosmetic/whitening", "/cosmetic/veneers", "/cosmetic/bonding"],
    why: "Unique descriptions improve click-through rate from search results.",
    fix: "Write a unique 140–155 character description per page.",
  },
  {
    id: "i8", title: "NAP mismatch: suite number", category: "Local", severity: "warning",
    pages: ["/contact"],
    why: "Inconsistent address data across the web can dilute trust signals.",
    fix: "Remove “Ste 200” from the footer and contact page to match GBP.",
    autoFix: { executor: "WordPress", before: "1204 S Congress Ave, Ste 200", after: "1204 S Congress Ave" },
  },
];

// ---------- Improvement actions ----------

export type ActionStatus = "suggested" | "approved" | "running" | "done";
export type Action = {
  id: string;
  title: string;
  category: "GBP" | "Reviews" | "On-page" | "Citations" | "Content";
  impact: "High" | "Medium" | "Low";
  effort: "Auto" | "Low" | "Medium";
  executor: "Google Business Profile API" | "WordPress" | "Manual" | "Citation network";
  status: ActionStatus;
  rationale: string;
  evidence: string[];
  preview?: { label: string; before?: string; after: string };
  steps: string[];
  keywordIds?: string[];
};

export const actions: Action[] = [
  {
    id: "a1", keywordIds: ["kw_3", "kw_4"], title: "Add 3 secondary categories to your Business Profile", category: "GBP", impact: "High", effort: "Auto",
    executor: "Google Business Profile API", status: "suggested",
    rationale: "Categories are the strongest controllable map-pack factor. The pack leaders use categories you don't.",
    evidence: ["Bright Smile Austin ranks #1 at 31/49 grid points with “Emergency dental service”", "“emergency dentist austin” — you average #8.2 in the grid"],
    preview: { label: "Categories", before: "Dentist · Cosmetic dentist", after: "Dentist · Cosmetic dentist · Emergency dental service · Teeth whitening service · Dental implants provider" },
    steps: ["Validate category IDs against GBP taxonomy", "PATCH locations/{id} categories.additionalCategories", "Confirm the change is live", "Schedule grid re-scan in 7 days"],
  },
  {
    id: "a2", keywordIds: ["kw_1", "kw_2", "kw_3"], title: "Publish weekly GBP posts for the next 4 weeks", category: "GBP", impact: "Medium", effort: "Auto",
    executor: "Google Business Profile API", status: "suggested",
    rationale: "Regular posts keep the profile fresh. Competitors in the pack post 3–6 times a month.",
    evidence: ["You: 1 post in 30 days", "Bright Smile Austin: 6 posts in 30 days"],
    preview: { label: "Post 1 of 4 — scheduled Mon 9:00", after: "Chipped a tooth over the weekend? We keep same-day emergency slots open every weekday on South Congress. Call (512) 555-0142 or book online." },
    steps: ["Generate 4 drafts from your services", "Attach photos from the media library", "Create localPosts with schedule", "Track post views in GBP insights"],
  },
  {
    id: "a3", keywordIds: ["kw_3", "kw_5"], title: "Rewrite business description with missing service terms", category: "GBP", impact: "Medium", effort: "Auto",
    executor: "Google Business Profile API", status: "approved",
    rationale: "Your description doesn't mention emergency care or Invisalign, two of your highest-volume services.",
    evidence: ["“invisalign austin” 2,400/mo — map rank #6", "“emergency dentist austin” 1,900/mo — map rank #8"],
    preview: {
      label: "Business description",
      before: "Maple & Main Dental is a friendly dental office in Austin providing quality care for the whole family.",
      after: "Maple & Main Dental is a South Congress dental office offering same-day emergency appointments, Invisalign, teeth whitening, implants and gentle family dentistry for Austin patients of all ages.",
    },
    steps: ["Check length (≤750 chars) and policy", "PATCH locations/{id} profile.description", "Confirm the change is live"],
  },
  {
    id: "a4", keywordIds: ["kw_1", "kw_2"], title: "Reply to 9 unanswered reviews", category: "Reviews", impact: "Medium", effort: "Low",
    executor: "Google Business Profile API", status: "suggested",
    rationale: "Responding to reviews signals engagement and is a chance to reinforce service + location terms naturally.",
    evidence: ["Response rate 61% (leaders 95%+)", "Oldest unanswered: 23 days"],
    preview: { label: "Reply to Jenna R. ★★★★★", after: "Thank you, Jenna! We're so glad the emergency visit got you out of pain quickly. See you at your follow-up on South Congress. — Dr. Patel" },
    steps: ["Draft replies with your brand voice", "Human review (required for reviews)", "PUT reviews/{id}/reply", "Log replies"],
  },
  {
    id: "a5", keywordIds: ["kw_1", "kw_2"], title: "Launch post-visit review request SMS", category: "Reviews", impact: "High", effort: "Medium",
    executor: "Manual", status: "suggested",
    rationale: "Review velocity is your biggest gap against the pack leader (6/mo vs 14/mo).",
    evidence: ["Projected +6 reviews/mo at a 12% response rate on 50 patients/week"],
    steps: ["Connect your practice management system or upload a CSV", "Approve the message template", "Send 2 hours after appointments"],
  },
  {
    id: "a6", title: "Add 14 services with descriptions", category: "GBP", impact: "Medium", effort: "Auto",
    executor: "Google Business Profile API", status: "done",
    rationale: "Services help Google match your profile to specific queries.",
    evidence: ["Pack leaders list 20+ services"], steps: ["Generate services", "Update serviceItems", "Confirm the change is live"],
  },
  {
    id: "a7", keywordIds: ["kw_3", "kw_4", "kw_5", "kw_7"], title: "Add “Austin, TX” to 5 service page titles", category: "On-page", impact: "Medium", effort: "Auto",
    executor: "WordPress", status: "suggested",
    rationale: "Titles on service pages lack the city modifier used in high-volume local queries.",
    evidence: ["5 pages flagged in site audit"],
    preview: { label: "/emergency <title>", before: "Emergency Dental Care | Maple & Main", after: "Emergency Dentist in Austin, TX | Maple & Main Dental" },
    steps: ["Update Yoast/RankMath title via WP REST", "Purge cache", "Request indexing in Search Console"],
  },
  {
    id: "a8", keywordIds: ["kw_1", "kw_2", "kw_9"], title: "Add Dentist schema to homepage", category: "On-page", impact: "High", effort: "Auto",
    executor: "WordPress", status: "running",
    rationale: "No LocalBusiness structured data was found.",
    evidence: ["Site audit: critical issue"], steps: ["Generate JSON-LD", "Inject via header snippet", "Validate with Rich Results Test", "Request indexing"],
  },
  {
    id: "a9", keywordIds: ["kw_1"], title: "Fix 3 citations with an old suite number", category: "Citations", impact: "Low", effort: "Low",
    executor: "Citation network", status: "suggested",
    rationale: "Yellowpages, Superpages and Manta still list “Ste 200”.",
    evidence: ["Found in DataForSEO Business Data search"], steps: ["Submit corrections", "Monitor for 30 days"],
  },
];

// ---------- Keyword suggestions ----------

export type KeywordIdea = { term: string; volume: number; kd: number; cpc: number; intent: Keyword["intent"]; localPack: boolean; trend: number[]; competitorRanks?: number };

export const keywordIdeas: KeywordIdea[] = [
  ["same day dentist austin", 590, 21, 14.2, "transactional", true],
  ["dentist open saturday austin", 480, 17, 11.8, "transactional", true],
  ["affordable dentist austin", 1300, 33, 9.4, "commercial", true],
  ["dentist that takes medicaid austin", 880, 26, 6.1, "transactional", true],
  ["clear aligners austin", 390, 29, 18.9, "commercial", true],
  ["dental bonding austin", 260, 15, 12.3, "commercial", true],
  ["gum disease treatment austin", 320, 22, 15.6, "transactional", true],
  ["kids dentist near zilker", 140, 9, 8.2, "transactional", true],
  ["how long does teeth whitening last", 4400, 24, 1.1, "informational", false],
  ["invisalign cost austin", 720, 28, 16.4, "commercial", false],
  ["tooth extraction cost austin", 590, 19, 7.7, "commercial", false],
  ["best invisalign provider austin", 210, 31, 21.0, "commercial", true],
].map(([term, volume, kd, cpc, intent, localPack], i) => {
  const r = rng(i + 101);
  return {
    term: term as string, volume: volume as number, kd: kd as number, cpc: cpc as number,
    intent: intent as Keyword["intent"], localPack: localPack as boolean,
    trend: Array.from({ length: 12 }, () => Math.round(40 + r() * 60)),
    competitorRanks: i % 3 === 0 ? Math.ceil(r() * 5) : undefined,
  };
});

// ---------- GBP: reviews & posts ----------

export const reviews = [
  { id: "r1", author: "Jenna R.", rating: 5, date: "2 days ago", text: "Cracked a molar on Sunday and they fit me in first thing Monday. Painless and so kind.", replied: false },
  { id: "r2", author: "Marcus T.", rating: 4, date: "5 days ago", text: "Great cleaning, a bit of a wait in the lobby but the hygienist was excellent.", replied: false },
  { id: "r3", author: "Priya S.", rating: 5, date: "1 week ago", text: "Finished my Invisalign here — results are amazing. Highly recommend Dr. Patel.", replied: true },
  { id: "r4", author: "Dan K.", rating: 2, date: "2 weeks ago", text: "Billing was confusing and I got charged twice. Front desk fixed it eventually.", replied: false },
  { id: "r5", author: "Alicia M.", rating: 5, date: "3 weeks ago", text: "My kids actually look forward to the dentist now.", replied: true },
];

export const gbpInsights = { calls: 184, callsPrev: 164, directions: 312, directionsPrev: 298, websiteClicks: 421, websiteClicksPrev: 447, views: 9840, viewsPrev: 8710 };

/** Weekly totals for the last 8 weeks (last 4 = this period), shaped to match gbpInsights. */
export const gbpWeekly = (() => {
  const r = rng(77);
  const spread = (prev: number, cur: number) => {
    const weeks = [...Array(4)].map(() => prev / 4 * (0.9 + r() * 0.2)).concat([...Array(4)].map(() => cur / 4 * (0.9 + r() * 0.2)));
    return weeks.map((v) => Math.round(v));
  };
  return {
    calls: spread(gbpInsights.callsPrev, gbpInsights.calls),
    directions: spread(gbpInsights.directionsPrev, gbpInsights.directions),
    websiteClicks: spread(gbpInsights.websiteClicksPrev, gbpInsights.websiteClicks),
    views: spread(gbpInsights.viewsPrev, gbpInsights.views),
  };
})();

// ---------- Dashboard series ----------

export const visibilitySeries = (() => {
  const r = rng(42);
  let v = 22;
  return Array.from({ length: 13 }, (_, i) => {
    v = Math.min(40, v + (r() - 0.25) * 2.4);
    const d = new Date(2026, 7, 2);
    d.setDate(d.getDate() + i * 7);
    return { date: d.toISOString().slice(0, 10), value: Math.round(v * 10) / 10 };
  });
})();

export const gscSeries = (() => {
  const r = rng(9);
  return Array.from({ length: 13 }, (_, i) => ({ date: visibilitySeries[i].date, value: Math.round(380 + i * 18 + r() * 60) }));
})();

export const activity = [
  { when: "Today, 06:14", text: "Weekly grid scan completed for 12 keywords", kind: "scan" },
  { when: "Yesterday", text: "Added 14 services to Business Profile", kind: "exec" },
  { when: "Yesterday", text: "“invisalign austin” entered the map pack (#3)", kind: "win" },
  { when: "Oct 25", text: "Site audit: score improved 68 → 74", kind: "audit" },
  { when: "Oct 23", text: "New 2★ review from Dan K. needs a reply", kind: "alert" },
];

export const reports = [
  { id: "rep1", name: "Monthly performance — October", schedule: "Monthly, 1st", recipients: "owner@mapleandmain.com", last: "Oct 1", format: "PDF + link" },
  { id: "rep2", name: "Weekly rankings digest", schedule: "Weekly, Mon 8:00", recipients: "team@mapleandmain.com", last: "Oct 27", format: "Email" },
  { id: "rep3", name: "Competitor movement alert", schedule: "On change", recipients: "Slack #marketing", last: "Oct 24", format: "Slack" },
];

// ---------- Content: website articles & GBP posts ----------

export type ContentStatus = "idea" | "draft" | "scheduled" | "published";
export type ContentItem = { id: string; title: string; status: ContentStatus; keywordId: string; date: string; metric?: string; words?: number };

export const blogPosts: ContentItem[] = [
  { id: "b1", title: "What counts as a dental emergency? (and what to do tonight)", status: "idea", keywordId: "kw_3", date: "Suggested", words: 1400 },
  { id: "b2", title: "Invisalign cost in Austin: a 2026 price guide", status: "draft", keywordId: "kw_5", date: "Edited 2d ago", words: 1120 },
  { id: "b3", title: "How long does teeth whitening last?", status: "scheduled", keywordId: "kw_4", date: "Nov 4", words: 980 },
  { id: "b4", title: "Dental cleaning without insurance: what it costs in Austin", status: "published", keywordId: "kw_16", date: "Oct 12", metric: "412 clicks" },
  { id: "b5", title: "Implants vs. bridges: which is right for you?", status: "published", keywordId: "kw_7", date: "Sep 30", metric: "188 clicks" },
];

export const gbpPosts: ContentItem[] = [
  { id: "p1", title: "Same-day emergency appointments on South Congress", status: "draft", keywordId: "kw_3", date: "Ready to publish" },
  { id: "p2", title: "Free Invisalign consult this November", status: "scheduled", keywordId: "kw_5", date: "Mon Nov 9" },
  { id: "p3", title: "Meet Dr. Patel", status: "scheduled", keywordId: "kw_1", date: "Mon Nov 16" },
  { id: "p4", title: "Whitening before the holidays", status: "published", keywordId: "kw_4", date: "Oct 21", metric: "640 views" },
];

/** Older published content, newest first. Only the Content page and reports show this far back. */
export const contentArchive: (ContentItem & { type: "article" | "post" })[] = [
  { id: "a1", type: "post", title: "Now booking Saturday cleanings", status: "published", keywordId: "kw_12", date: "Oct 7", metric: "512 views" },
  { id: "a2", type: "article", title: "Root canal recovery: a day-by-day guide", status: "published", keywordId: "kw_10", date: "Sep 18", words: 1350, metric: "96 clicks" },
  { id: "a3", type: "post", title: "Back-to-school checkups for kids", status: "published", keywordId: "kw_6", date: "Aug 26", metric: "731 views" },
  { id: "a4", type: "article", title: "Veneers vs. bonding: cost, lifespan and look", status: "published", keywordId: "kw_13", date: "Aug 14", words: 1600, metric: "143 clicks" },
  { id: "a5", type: "post", title: "Sedation options for anxious patients", status: "published", keywordId: "kw_15", date: "Aug 5", metric: "388 views" },
];

export const auditKeywordLinks: Record<string, string[]> = { i1: ["kw_1", "kw_9"], i2: ["kw_3", "kw_4", "kw_5", "kw_7"], i4: ["kw_1"], i5: ["kw_3", "kw_6"], i6: ["kw_1"], i8: ["kw_1", "kw_9"] };

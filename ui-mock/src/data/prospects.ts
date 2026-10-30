// Mock prospecting data. A search (keyword or Google category, around a city,
// ZIP or lat/lng) returns every business in the local results, enriched with
// contact details and scored by how easy they'd be to sell to. Real build:
// see `prospectSources` below for which API fills which field.

import type { GridScan } from "./mock";

function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return Math.abs(h);
}

const pick = <T,>(xs: readonly T[], r: () => number) => xs[Math.floor(r() * xs.length)];
const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// ---------- Niches ----------

type Niche = { match: RegExp; label: string; ticket: number; nouns: string[]; categories: string[] };

const niches: Niche[] = [
  { match: /dent|orthodont|invisalign/, label: "Dentist", ticket: 850, nouns: ["Dental", "Family Dentistry", "Dental Studio", "Smiles", "Dental Care"], categories: ["Dentist", "Cosmetic dentist", "Emergency dental service", "Pediatric dentist", "Dental clinic"] },
  { match: /plumb|drain|water heater/, label: "Plumber", ticket: 420, nouns: ["Plumbing", "Plumbing & Drain", "Rooter", "Plumbing Co."], categories: ["Plumber", "Drainage service", "Water heater installation service", "Emergency plumber", "Septic system service"] },
  { match: /roof/, label: "Roofing contractor", ticket: 9500, nouns: ["Roofing", "Roofing & Exteriors", "Roof Pros", "Roofing Co."], categories: ["Roofing contractor", "Gutter service", "Siding contractor", "Skylight contractor", "General contractor"] },
  { match: /hvac|\bac\b|air cond|heating|cooling|furnace/, label: "HVAC contractor", ticket: 650, nouns: ["Heating & Air", "Air", "Comfort Systems", "AC & Heating"], categories: ["HVAC contractor", "Air conditioning repair service", "Heating contractor", "Furnace repair service", "Air duct cleaning service"] },
  { match: /law|attorney|lawyer|legal/, label: "Law firm", ticket: 4000, nouns: ["Law Group", "Law Firm", "Legal", "Injury Lawyers"], categories: ["Personal injury attorney", "Law firm", "Legal services", "Trial attorney", "Car accident lawyer"] },
  { match: /chiro|spine|back pain/, label: "Chiropractor", ticket: 300, nouns: ["Chiropractic", "Spine & Wellness", "Chiropractic Center", "Wellness"], categories: ["Chiropractor", "Massage therapist", "Physical therapy clinic", "Sports medicine clinic", "Wellness center"] },
  { match: /spa|botox|aesthetic|filler|facial/, label: "Medical spa", ticket: 450, nouns: ["Med Spa", "Aesthetics", "Skin Studio", "Medspa"], categories: ["Medical spa", "Skin care clinic", "Laser hair removal service", "Facial spa", "Beauty salon"] },
];

const prefixes = ["Bright", "Lone Star", "Capitol", "Barton Creek", "Southside", "Riverside", "Oak Hill", "Cedar", "Summit", "Hill Country", "Eastside", "Main Street", "Pioneer", "Northgate", "Liberty", "Bluebonnet", "Westlake", "Heritage"];

function nicheFor(keyword: string): Niche {
  const k = keyword.toLowerCase();
  const n = niches.find((x) => x.match.test(k));
  if (n) return n;
  const base = k.replace(/\b(near me|best|in|top|cheap|affordable|emergency|local)\b/g, "").trim().replace(/\s+/g, " ") || "service";
  const word = base.replace(/\b\w/g, (c) => c.toUpperCase());
  return { match: /.^/, label: word, ticket: 500, nouns: [word, `${word} Co.`, `${word} Pros`, `${word} Services`], categories: [word, `${word} service`, `${word} contractor`, `${word} supplier`, `${word} consultant`] };
}

// ---------- Types ----------

export type SiteCheck = {
  score: number;
  lcp: number; // seconds, mobile
  mobile: boolean;
  https: boolean;
  schema: boolean;
  titleHasCity: boolean;
  napMatches: boolean;
  servicePages: number;
  pages: number;
};

export type PhoneType = "Mobile" | "Landline" | "VoIP";
export type EmailStatus = "verified" | "catch-all" | "unverified";
export type Confidence = "high" | "medium" | "low";

export type Contact = {
  phoneType: PhoneType;
  carrier: string;
  sms: boolean; // line can receive texts (mobile, or VoIP with SMS enabled)
  email: string | null;
  emailStatus: EmailStatus | null;
  emailSource: string | null;
  altEmails: string[];
  owner: { name: string; title: string; source: string; confidence: Confidence; linkedin: string | null } | null;
  socials: { facebook: string | null; instagram: string | null; linkedin: string | null; yelp: string | null };
  bookingUrl: string | null;
};

export type Company = {
  founded: number | null;
  employees: "1–10" | "11–50" | "51–200";
  domainAgeYrs: number | null;
  cms: "WordPress" | "Wix" | "Squarespace" | "GoDaddy" | "Custom" | null;
  analytics: boolean; // GA4 or GTM found
  adPixel: boolean; // Meta / Google Ads pixel found
  chatWidget: boolean;
  referringDomains: number;
  organicTraffic: number; // est. monthly visits, DataForSEO Labs
  adSpend: number | null; // est. monthly Google Ads spend
  priceLevel: 1 | 2 | 3 | null;
  attributes: string[];
};

export type Prospect = {
  id: string;
  placeId: string;
  cid: string;
  lat: number;
  lng: number;
  zip: string;
  contact: Contact;
  company: Company;
  lastReviewDays: number;
  name: string;
  category: string;
  categories: string[];
  address: string;
  phone: string;
  distanceMi: number;
  website: string | null;
  rating: number;
  reviews: number;
  reviewVelocity: number;
  replyRate: number; // % of reviews with an owner reply
  photos: number;
  posts30d: number;
  claimed: boolean;
  hasHours: boolean;
  hasDescription: boolean;
  mapRank: number | null; // null = outside the top 20
  organicRank: number | null;
  runsAds: boolean;
  hasAgency: boolean;
  site: SiteCheck | null;
};

export type QuickWin = {
  id: string;
  title: string;
  detail: string;
  area: "Business Profile" | "Reviews" | "Website";
  effort: string;
  minutes: number;
  impact: "high" | "medium" | "low";
  gain: number; // rough map-pack positions this is worth
};

export type Market = {
  keyword: string;
  city: string;
  spec: Spec;
  center: { lat: number; lng: number };
  niche: string;
  volume: number;
  ticket: number;
  prospects: Prospect[];
};

// ---------- Search ----------

export type SearchBy = "keyword" | "category";
export type Spec = {
  q: string;
  by: SearchBy;
  city: string;
  zip: string | null;
  lat: number | null; // set both lat and lng to search around a pin instead of the city centre
  lng: number | null;
  radiusMi: number;
  depth: number; // how many businesses to pull: 20 / 50 / 100
  noSite: boolean; // only businesses with no website (Business Listings filter ["url", "=", null])
  biz: string | null; // direct audit: one named business, measured against this keyword
};

export const defaultSpec: Spec = { q: "plumber", by: "keyword", city: "Austin, TX", zip: null, lat: null, lng: null, radiusMi: 5, depth: 20, noSite: false, biz: null };

export function specFromParams(p: URLSearchParams): Spec {
  const num = (k: string) => { const v = p.get(k); return v === null || v === "" || isNaN(Number(v)) ? null : Number(v); };
  return {
    q: p.get("kw") ?? defaultSpec.q,
    by: p.get("by") === "category" ? "category" : "keyword",
    city: p.get("city") ?? defaultSpec.city,
    zip: p.get("zip") || null,
    lat: num("lat"),
    lng: num("lng"),
    radiusMi: num("r") ?? defaultSpec.radiusMi,
    depth: num("n") ?? defaultSpec.depth,
    noSite: p.get("ns") === "1",
    biz: p.get("biz") || null,
  };
}

export function specToQuery(s: Spec) {
  const p = new URLSearchParams({ kw: s.q, city: s.city });
  if (s.by !== "keyword") p.set("by", s.by);
  if (s.zip) p.set("zip", s.zip);
  if (s.lat !== null && s.lng !== null) { p.set("lat", String(s.lat)); p.set("lng", String(s.lng)); }
  if (s.radiusMi !== defaultSpec.radiusMi) p.set("r", String(s.radiusMi));
  if (s.depth !== defaultSpec.depth) p.set("n", String(s.depth));
  if (s.noSite) p.set("ns", "1");
  if (s.biz) p.set("biz", s.biz);
  return `?${p.toString()}`;
}

const cityCenters: Record<string, [number, number, string]> = {
  austin: [30.2672, -97.7431, "787"],
  "round rock": [30.5083, -97.6789, "786"],
  "cedar park": [30.5052, -97.8203, "786"],
  georgetown: [30.6333, -97.677, "786"],
  "san marcos": [29.8833, -97.9414, "786"],
  dallas: [32.7767, -96.797, "752"],
  houston: [29.7604, -95.3698, "770"],
};

export const googleCategories = [...new Set(niches.flatMap((n) => n.categories))].sort();

const surnames = ["Garcia", "Nguyen", "Patel", "Johnson", "Martinez", "Kim", "Walker", "Reyes", "Thompson", "Lopez", "Brooks", "Hernandez", "Carter", "Okafor", "Silva", "Bennett", "Morales", "Fischer", "Ramirez", "Coleman", "Ortiz", "Shah", "Dawson", "Flores"];
const firstNames = ["Maria", "James", "Priya", "David", "Carlos", "Sarah", "Michael", "Ana", "Kevin", "Jasmine", "Luis", "Emily", "Robert", "Nina", "Tom", "Grace", "Daniel", "Rosa", "Andre", "Leah"];
const ownerTitles: Record<string, string[]> = {
  Dentist: ["Owner & Lead Dentist, DDS", "Founder, DMD", "Practice Owner"],
  "Law firm": ["Founding Partner", "Managing Attorney", "Principal Attorney"],
  Chiropractor: ["Owner, DC", "Founder & Chiropractor"],
  "Medical spa": ["Founder & Medical Director", "Owner, RN"],
};
const carriers: Record<PhoneType, string[]> = { Mobile: ["Verizon Wireless", "T-Mobile", "AT&T Mobility"], Landline: ["AT&T", "Spectrum", "Frontier"], VoIP: ["RingCentral", "Google Voice", "Grasshopper", "Twilio"] };
const streets = ["S Congress Ave", "Burnet Rd", "S Lamar Blvd", "E 6th St", "N Lamar Blvd", "Manchaca Rd", "W Anderson Ln", "E Riverside Dr", "Research Blvd", "Brodie Ln"];
const attributePool = ["Women-owned", "Veteran-owned", "Latino-owned", "Black-owned", "Family-owned", "Online appointments", "Onsite services", "Free estimates", "24/7"];

export function searchMarket(input: Spec | string, legacyCity?: string): Market {
  const spec: Spec = typeof input === "string" ? { ...defaultSpec, q: input, city: legacyCity ?? defaultSpec.city } : input;
  const kw = spec.q.trim().toLowerCase();
  const city = spec.city.trim() || defaultSpec.city;
  const niche = nicheFor(kw);
  const cityName = city.split(",")[0].trim() || "Austin";
  const known = cityCenters[cityName.toLowerCase()] ?? cityCenters.austin;
  const center = spec.lat !== null && spec.lng !== null ? { lat: spec.lat, lng: spec.lng } : { lat: known[0], lng: known[1] };
  const seed = `${spec.by}|${kw}|${city.toLowerCase()}|${spec.zip ?? ""}|${spec.lat ?? ""},${spec.lng ?? ""}${spec.noSite ? "|ns" : ""}`;
  const volume = Math.round((300 + rng(hash(seed))() * 3700) / 10) * 10;
  const count = Math.max(5, Math.min(100, spec.depth));
  const used = new Set<string>();
  const prospects: Prospect[] = [];

  for (let i = 0; i < count; i++) {
    // One generator per position, so pulling 50 instead of 20 keeps the first 20 identical.
    const r = rng(hash(`${seed}#${i}`));
    // Strength drives rank; noise lets good businesses sit low (the low-hanging fruit).
    const strength = Math.max(0, 1 - i / 16);
    const ownerSurname = surnames[Math.floor(r() * surnames.length)];
    let name = "";
    for (let tries = 0; !name || used.has(name); tries++) {
      const roll = r();
      const pre = roll > 0.82 ? cityName : roll > 0.55 ? ownerSurname : prefixes[Math.floor(r() * prefixes.length)];
      name = `${pre} ${niche.nouns[Math.floor(r() * niche.nouns.length)]}${tries > 6 ? ` ${tries}` : ""}`;
    }
    used.add(name);

    // In a no-website search everyone except the pack leaders comes from the
    // listings filter; the top 3 are still pulled so there's someone to compare against.
    const hasSite = r() > 0.12 + (1 - strength) * 0.18 && !(spec.noSite && i >= 3);
    const catCount = 1 + Math.round(strength * 3 * r() + (i < 3 ? 1 : 0));
    const reviews = Math.round(4 + strength * 160 + strength * 380 * r() + r() * 20);
    const site: SiteCheck | null = hasSite
      ? {
          score: Math.round(32 + r() * 40 + strength * 20),
          lcp: Math.round((1.4 + r() * 3.6) * 10) / 10,
          mobile: r() > 0.18,
          https: r() > 0.08,
          schema: r() > 0.62 - strength * 0.3,
          titleHasCity: r() > 0.55 - strength * 0.3,
          napMatches: r() > 0.35,
          servicePages: Math.round(r() * 7 + strength * 4),
          pages: Math.round(6 + r() * 60),
        }
      : null;
    const organic = hasSite ? Math.round(1 + (1 - strength) * 22 + r() * 10) : null;
    const domain = hasSite ? `${slugify(name).replace(/-/g, "")}.com` : null;

    // Place the business inside the search radius.
    const ang = r() * Math.PI * 2;
    const dist = Math.round((0.2 + Math.sqrt(r()) * (spec.radiusMi - 0.2)) * 10) / 10;
    const lat = center.lat + (Math.sin(ang) * dist) / 69;
    const lng = center.lng + (Math.cos(ang) * dist) / (69 * Math.cos((center.lat * Math.PI) / 180));

    // Contact enrichment. Small shops without a site are far more often run off the owner's cell.
    const phoneRoll = r();
    const phoneType: PhoneType = phoneRoll < (hasSite ? 0.22 : 0.6) ? "Mobile" : phoneRoll < 0.62 ? "VoIP" : "Landline";
    const first = firstNames[Math.floor(r() * firstNames.length)];
    const ownerFound = r() > (hasSite ? 0.18 : 0.45);
    const ownerSrc = ["Website · About page", "Owner replies on Google reviews", "Texas Secretary of State filing", "LinkedIn", "Domain WHOIS"][Math.floor(r() * (hasSite ? 5 : 3))];
    const emailRoll = r();
    const email = domain
      ? emailRoll > 0.15 ? (emailRoll > 0.55 ? `${first.toLowerCase()}@${domain}` : `info@${domain}`) : null
      : emailRoll > 0.55 ? `${slugify(name).replace(/-/g, "")}@gmail.com` : null;
    const emailStatus: EmailStatus | null = !email ? null : email.startsWith("info@") ? "catch-all" : r() > 0.2 ? "verified" : "unverified";
    const handle = slugify(name).replace(/-/g, "");
    const founded = r() > 0.15 ? 2026 - Math.round(1 + r() * (6 + strength * 30)) : null;
    const runsAds = r() > 0.68;

    prospects.push({
      id: slugify(name),
      placeId: `ChIJ${(hash(name) % 1e10).toString(36)}${(hash(city) % 1e8).toString(36)}`,
      cid: String(hash(name + city) * 1000 + i),
      lat: Math.round(lat * 1e5) / 1e5,
      lng: Math.round(lng * 1e5) / 1e5,
      zip: spec.zip ?? `${known[2]}${String(Math.floor(r() * 50)).padStart(2, "0")}`,
      name,
      category: niche.categories[0],
      categories: niche.categories.slice(0, Math.min(niche.categories.length, catCount)),
      address: `${100 + Math.floor(r() * 9800)} ${streets[Math.floor(r() * streets.length)]}, ${city}`,
      phone: `(512) 555-${String(1000 + Math.floor(r() * 8999)).slice(0, 4)}`,
      distanceMi: dist,
      website: domain,
      rating: Math.min(5, Math.round((3.5 + r() * 1.5) * 10) / 10),
      reviews,
      reviewVelocity: Math.max(0, Math.round(reviews / 45 + r() * 3 * strength)),
      lastReviewDays: Math.round(1 + r() * (strength > 0.5 ? 20 : 120)),
      replyRate: Math.round(r() * 100 * (0.3 + strength * 0.7)),
      photos: Math.round(2 + strength * 70 * r() + (i < 3 ? 30 : 0)),
      posts30d: r() > 0.55 + (1 - strength) * 0.3 ? Math.round(1 + r() * 5) : 0,
      claimed: i < 3 || r() > 0.14,
      hasHours: i < 3 || r() > 0.2,
      hasDescription: r() > 0.45 - strength * 0.3,
      mapRank: i < 20 ? i + 1 : null,
      organicRank: organic !== null && organic <= 30 ? organic : null,
      runsAds,
      hasAgency: strength > 0.65 ? r() > 0.35 : r() > 0.85,
      site,
      contact: {
        phoneType,
        carrier: carriers[phoneType][Math.floor(r() * carriers[phoneType].length)],
        sms: phoneType === "Mobile" || (phoneType === "VoIP" && r() > 0.35),
        email,
        emailStatus,
        emailSource: !email ? null : domain ? (email.startsWith("info@") ? "Website · Contact page" : "Website · About page + pattern match") : "Facebook page",
        altEmails: domain && email && r() > 0.6 ? [email.startsWith("info@") ? `office@${domain}` : `info@${domain}`] : [],
        owner: ownerFound
          ? {
              name: `${first} ${ownerSurname}`,
              title: pick(ownerTitles[niche.label] ?? ["Owner", "Founder & Owner", "Owner / Operator"], r),
              source: ownerSrc,
              confidence: ownerSrc.includes("Secretary") || ownerSrc.includes("About") ? "high" : ownerSrc.includes("reviews") ? "medium" : "low",
              linkedin: r() > 0.5 ? `linkedin.com/in/${first.toLowerCase()}-${ownerSurname.toLowerCase()}` : null,
            }
          : null,
        socials: {
          facebook: r() > 0.3 ? `facebook.com/${handle}` : null,
          instagram: r() > 0.55 ? `instagram.com/${handle}` : null,
          linkedin: r() > 0.7 ? `linkedin.com/company/${slugify(name)}` : null,
          yelp: r() > 0.4 ? `yelp.com/biz/${slugify(name)}-${slugify(cityName)}` : null,
        },
        bookingUrl: domain && r() > 0.6 ? `${domain}/book` : null,
      },
      company: {
        founded,
        employees: strength > 0.7 && r() > 0.4 ? "11–50" : strength > 0.9 && r() > 0.7 ? "51–200" : "1–10",
        domainAgeYrs: domain ? Math.max(1, Math.round((founded ? 2026 - founded : 4) * (0.5 + r() * 0.5))) : null,
        cms: domain ? (["WordPress", "WordPress", "Wix", "Squarespace", "GoDaddy", "Custom"] as const)[Math.floor(r() * 6)] : null,
        analytics: !!domain && r() > 0.4,
        adPixel: !!domain && (runsAds || r() > 0.75),
        chatWidget: !!domain && r() > 0.7,
        referringDomains: domain ? Math.round(3 + strength * 140 * r()) : 0,
        organicTraffic: domain ? Math.round((20 + strength * 1800 * r()) / 10) * 10 : 0,
        adSpend: runsAds ? Math.round((300 + r() * 4000) / 50) * 50 : null,
        priceLevel: r() > 0.5 ? ((1 + Math.floor(r() * 3)) as 1 | 2 | 3) : null,
        attributes: attributePool.filter(() => r() > 0.82),
      },
    });
  }
  const market: Market = { keyword: kw, city, spec: { ...spec, city }, center, niche: niche.label, volume, ticket: niche.ticket, prospects };
  return spec.biz ? withBusiness(market, spec.biz) : market;
}

// ---------- Direct audit (one named business, no prospecting search) ----------

export type BizMatch = { name: string; address: string; category: string; rating: number; reviews: number; website: string | null; claimed: boolean; keyword: string };

export const prospectId = (name: string) => slugify(name);
const titleCase = (s: string) => s.replace(/(^|\s)\w/g, (c) => c.toUpperCase());

/** Pull a business name out of a Google Maps link (…/maps/place/Lopez+Plumbing/@…), or null. */
export function nameFromMapsLink(input: string) {
  const m = input.match(/\/maps\/place\/([^/@?]+)/);
  return m ? decodeURIComponent(m[1].replace(/\+/g, " ")).trim() : null;
}

/**
 * Find a business by name (or Maps link) and city. Real build: Business Data
 * google/my_business_info with keyword = name and location = city, which
 * returns the closest profiles; several matches mean several locations.
 */
export function lookupBusiness(query: string, city: string): BizMatch[] {
  const name = titleCase(nameFromMapsLink(query) ?? query.trim());
  if (!name) return [];
  const lower = name.toLowerCase();
  const niche = niches.find((x) => x.match.test(lower));
  const word = lower.split(/\s+/).filter((w) => !/^(&|and|the|co\.?|llc|inc\.?)$/.test(w)).pop() ?? "business";
  const category = niche?.categories[0] ?? titleCase(word);
  const keyword = niche ? niche.label.toLowerCase() : word;
  const r = rng(hash(`${lower}|${city.toLowerCase()}`));
  const make = (n: string): BizMatch => {
    const site = r() > 0.3;
    return {
      name: n,
      address: `${100 + Math.floor(r() * 9800)} ${streets[Math.floor(r() * streets.length)]}, ${city}`,
      category,
      rating: Math.min(5, Math.round((3.6 + r() * 1.4) * 10) / 10),
      reviews: Math.round(8 + r() * 260),
      website: site ? `${slugify(n).replace(/-/g, "")}.com` : null,
      claimed: r() > 0.18,
      keyword,
    };
  };
  const out = [make(name)];
  if (r() > 0.45) out.push(make(`${name} — ${pick(["North", "South", "Downtown", "Westlake"], r)}`));
  if (r() > 0.55) out.push(make(`${name.split(" ")[0]} ${pick(niche?.nouns ?? ["Co.", "Services", "Pros"], r)}`));
  return out.filter((x, i, a) => a.findIndex((y) => y.name === x.name) === i);
}

/** Put the named business into a market (or find it there) so the normal audit works on it. */
function withBusiness(m: Market, bizName: string): Market {
  const match = lookupBusiness(bizName, m.city).find((x) => x.name.toLowerCase() === bizName.toLowerCase()) ?? lookupBusiness(bizName, m.city)[0];
  if (!match) return m;
  const existing = m.prospects.findIndex((p) => p.name.toLowerCase() === match.name.toLowerCase());
  const slot = existing >= 0 ? existing : 3 + (hash(match.name) % Math.max(1, Math.min(10, m.prospects.length - 3)));
  const old = m.prospects[slot];
  // Re-key the slot's generated details (handles, emails, socials) to the real name.
  const oldHandle = slugify(old.name).replace(/-/g, ""), newHandle = slugify(match.name).replace(/-/g, "");
  const renamed: Prospect = JSON.parse(JSON.stringify(old).split(old.name).join(match.name).split(slugify(old.name)).join(slugify(match.name)).split(oldHandle).join(newHandle));
  const r = rng(hash(match.name));
  const site: SiteCheck | null = !match.website ? null : renamed.site ?? {
    score: Math.round(40 + r() * 40), lcp: Math.round((1.6 + r() * 3) * 10) / 10, mobile: r() > 0.2, https: r() > 0.1, schema: r() > 0.6,
    titleHasCity: r() > 0.5, napMatches: r() > 0.4, servicePages: Math.round(r() * 6), pages: Math.round(5 + r() * 30),
  };
  const biz: Prospect = {
    ...renamed,
    address: match.address, category: match.category, rating: match.rating, reviews: match.reviews, claimed: match.claimed,
    website: match.website, site, organicRank: match.website ? renamed.organicRank : null,
    contact: { ...renamed.contact, email: !match.website && renamed.contact.email && !renamed.contact.email.endsWith("gmail.com") ? `${newHandle}@gmail.com` : renamed.contact.email, bookingUrl: match.website ? renamed.contact.bookingUrl : null },
    company: match.website ? renamed.company : { ...renamed.company, cms: null, analytics: false, adPixel: false, chatWidget: false, referringDomains: 0, organicTraffic: 0, domainAgeYrs: null },
  };
  const prospects = [...m.prospects];
  prospects[slot] = biz;
  return { ...m, prospects };
}

export function findProspect(market: Market, id: string) {
  return market.prospects.find((p) => p.id === id);
}

export const leadersOf = (m: Market) => m.prospects.filter((p) => p.mapRank !== null && p.mapRank <= 3);

// ---------- Scoring ----------

export function quickWins(p: Prospect, m: Market): QuickWin[] {
  const leaders = leadersOf(m).filter((l) => l.id !== p.id);
  const avg = (f: (x: Prospect) => number) => (leaders.length ? leaders.reduce((a, l) => a + f(l), 0) / leaders.length : 0);
  const leaderReviews = Math.round(avg((l) => l.reviews));
  const leaderCats = Math.round(avg((l) => l.categories.length));
  const leaderPhotos = Math.round(avg((l) => l.photos));
  const w: QuickWin[] = [];
  const add = (x: QuickWin) => w.push(x);

  if (!p.claimed) add({ id: "claim", title: "Claim and verify the Google Business Profile", detail: "The profile is unclaimed, so anyone can suggest edits and none of the owner-only features work. Fixing this comes before everything else.", area: "Business Profile", effort: "1–5 days (postcard)", minutes: 30, impact: "high", gain: 3 });
  if (p.categories.length < leaderCats) {
    const missing = m.prospects.flatMap((x) => x.categories).filter((c, i, a) => a.indexOf(c) === i && !p.categories.includes(c)).slice(0, leaderCats - p.categories.length);
    add({ id: "cats", title: `Add ${missing.length} secondary categor${missing.length === 1 ? "y" : "ies"}`, detail: `The top 3 average ${leaderCats} categories. Missing: ${missing.join(", ")}.`, area: "Business Profile", effort: "10 min", minutes: 10, impact: "high", gain: 2 });
  }
  if (!p.hasHours) add({ id: "hours", title: "Add business hours", detail: "Without hours, Google often hides the listing for “open now” searches.", area: "Business Profile", effort: "5 min", minutes: 5, impact: "medium", gain: 1 });
  if (!p.hasDescription) add({ id: "desc", title: "Write a keyword-rich business description", detail: `Mention “${m.keyword}”, the services and the neighborhoods served in the 750-character description.`, area: "Business Profile", effort: "15 min", minutes: 15, impact: "medium", gain: 1 });
  if (p.photos < Math.max(25, leaderPhotos * 0.6)) add({ id: "photos", title: `Upload ${Math.max(15, leaderPhotos - p.photos)}+ real photos`, detail: `${p.photos} photos vs. ${leaderPhotos} for the top 3. Add team, storefront, interior and job photos.`, area: "Business Profile", effort: "45 min", minutes: 45, impact: "medium", gain: 1 });
  if (p.posts30d === 0) add({ id: "posts", title: "Post weekly Google updates", detail: "No posts in the last 30 days. Weekly offers and updates signal an active business.", area: "Business Profile", effort: "20 min / week", minutes: 20, impact: "low", gain: 1 });
  if (p.replyRate < 50) add({ id: "replies", title: "Reply to unanswered reviews", detail: `Only ${p.replyRate}% of reviews have an owner reply. Replying to the backlog takes one sitting.`, area: "Reviews", effort: "1 hr", minutes: 60, impact: "medium", gain: 1 });
  if (leaderReviews && p.reviews < leaderReviews * 0.6) add({ id: "reviews", title: "Start a review request campaign", detail: `${p.reviews} reviews vs. ${leaderReviews} for the top 3. An SMS ask after each job closes the gap in a few months.`, area: "Reviews", effort: "Ongoing", minutes: 240, impact: "high", gain: 2 });

  if (!p.site) {
    add({ id: "site", title: "Build a simple local website", detail: "No website is linked to the profile. Even a 5-page site with service pages and the city in titles is a big jump.", area: "Website", effort: "1 week", minutes: 2400, impact: "high", gain: 3 });
  } else {
    const s = p.site;
    if (!s.napMatches) add({ id: "nap", title: "Fix the name / address / phone mismatch", detail: "The address or phone on the website doesn't match the Business Profile, which weakens trust signals.", area: "Website", effort: "10 min", minutes: 10, impact: "high", gain: 1 });
    if (!s.schema) add({ id: "schema", title: "Add LocalBusiness schema", detail: "No structured data connects the site to the Business Profile.", area: "Website", effort: "15 min", minutes: 15, impact: "medium", gain: 1 });
    if (!s.titleHasCity) add({ id: "titles", title: "Put the city in page titles", detail: `Titles don't mention ${m.city.split(",")[0]}. Use “${m.keyword.replace(/\b\w/g, (c) => c.toUpperCase())} | ${p.name}”.`, area: "Website", effort: "20 min", minutes: 20, impact: "medium", gain: 1 });
    if (!s.https) add({ id: "https", title: "Install an SSL certificate", detail: "The site loads over http and shows a “Not secure” warning.", area: "Website", effort: "15 min", minutes: 15, impact: "medium", gain: 1 });
    if (!s.mobile) add({ id: "mobile", title: "Make the site mobile friendly", detail: "Most local searches are on phones and the site fails the mobile test.", area: "Website", effort: "2–3 days", minutes: 1200, impact: "high", gain: 2 });
    if (s.lcp > 2.5) add({ id: "speed", title: `Speed up mobile load (${s.lcp}s → under 2.5s)`, detail: "Compress the hero image, lazy-load below the fold, and defer chat and tracking scripts.", area: "Website", effort: "Half a day", minutes: 240, impact: "low", gain: 0 });
    if (s.servicePages < 3) add({ id: "pages", title: "Create a page for each core service", detail: `Only ${s.servicePages} service page${s.servicePages === 1 ? "" : "s"}. Competitors in the pack have one per service.`, area: "Website", effort: "2–3 days", minutes: 1200, impact: "medium", gain: 1 });
  }
  return w.sort((a, b) => a.minutes - b.minutes);
}

export type Opportunity = {
  score: number;
  label: "Hot" | "Warm" | "Cool";
  reasons: string[];
  wins: QuickWin[];
  easyWins: number;
  projectedRank: number;
  missedLeads: number;
  missedRevenue: number;
};

const packShare = (rank: number | null) => (rank === null ? 0 : rank === 1 ? 0.22 : rank === 2 ? 0.15 : rank === 3 ? 0.11 : rank <= 10 ? 0.02 : 0.005);

export function opportunity(p: Prospect, m: Market): Opportunity {
  const wins = quickWins(p, m);
  const easy = wins.filter((w) => w.minutes <= 60);
  const rank = p.mapRank ?? 21;
  const rankPts = rank <= 3 ? 6 : rank <= 7 ? 34 : rank <= 12 ? 28 : rank <= 20 ? 18 : 10;
  const winPts = Math.min(24, easy.length * 4 + (wins.length - easy.length));
  const qualityPts = p.rating >= 4.5 ? 16 : p.rating >= 4.2 ? 12 : p.rating >= 4 ? 8 : 3;
  const score = Math.min(99, rankPts + winPts + qualityPts + (p.hasAgency ? 0 : 12) + (p.runsAds ? 6 : 0));

  const gain = wins.reduce((a, w) => a + w.gain, 0);
  const projectedRank = Math.max(rank <= 6 ? 1 : 2, rank - Math.round(gain * 0.5));
  const leadRate = 0.08; // searches that click through and call / book
  const closeRate = 0.35; // leads that turn into a paid job
  const missedLeads = Math.max(0, Math.round(m.volume * (packShare(Math.min(3, projectedRank)) - packShare(p.mapRank)) * leadRate));

  const reasons: string[] = [];
  if (rank > 3 && rank <= 12) reasons.push(`Sits at #${rank} in the map pack, ${rank - 3} spot${rank - 3 === 1 ? "" : "s"} from the top 3`);
  if (rank <= 3) reasons.push(`Already in the top 3 at #${rank}, so there's less upside to sell`);
  if (p.rating >= 4.4) reasons.push(`${p.rating}★ rating: customers like them, Google isn't showing them`);
  if (easy.length) reasons.push(`${easy.length} fix${easy.length === 1 ? "" : "es"} take under an hour each`);
  if (!p.claimed) reasons.push("Profile is unclaimed, an easy opening line");
  if (!p.site) reasons.push("No website, so there's room for a bigger package");
  if (!p.hasAgency) reasons.push("No SEO agency detected");
  else reasons.push("Looks like they already work with an agency");
  if (p.runsAds) reasons.push("Already pays for Google Ads, so there's budget");

  return {
    score,
    label: score >= 80 ? "Hot" : score >= 62 ? "Warm" : "Cool",
    reasons,
    wins,
    easyWins: easy.length,
    projectedRank,
    missedLeads,
    missedRevenue: Math.round(missedLeads * closeRate) * m.ticket,
  };
}

/** Profile completeness out of 100, the same checks Google's own meter leans on. */
export function profileScore(p: Prospect) {
  const checks = [p.claimed, p.hasHours, p.hasDescription, p.photos >= 30, p.posts30d > 0, p.categories.length >= 3, p.replyRate >= 50, !!p.website];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

/** One number for the cover of the audit: map rank, profile and site health. */
export function visibilityScore(p: Prospect) {
  const rankPart = p.mapRank === null ? 0 : Math.max(0, 100 - (p.mapRank - 1) * 9);
  return Math.round(rankPart * 0.45 + profileScore(p) * 0.3 + (p.site?.score ?? 0) * 0.25);
}

// ---------- Geo-grid for a prospect ----------

export function prospectGrid(p: Prospect, m: Market, size = 7): GridScan {
  const r = rng(hash(p.id + m.keyword) + size);
  const c = (size - 1) / 2;
  const others = m.prospects.filter((x) => x.id !== p.id && x.mapRank !== null).sort((a, b) => a.mapRank! - b.mapRank!).map((x) => x.name);
  const rank = p.mapRank ?? 22;
  const points: GridScan["points"] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const dist = Math.hypot(row - c, col - c) + (col < c ? 0.5 : 0);
      const base = rank * 0.8 + dist * 1.2 + r() * 2 - 2.2;
      const pr = base > 20 ? null : Math.max(1, Math.round(base));
      // The local pack shuffles a little from point to point.
      const pool = others.slice(0, 5).sort(() => r() - 0.5);
      const top3 = pr && pr <= 3 ? [...pool.slice(0, pr - 1), p.name, ...pool.slice(pr - 1)].slice(0, 3) : pool.slice(0, 3);
      points.push({ row, col, rank: pr, top3 });
    }
  }
  // The front door is the business's real map-pack position, so the grid,
  // the table and the headline always agree.
  const mid = points.find((x) => x.row === c && x.col === c)!;
  const ranked = m.prospects.filter((x) => x.mapRank !== null).sort((a, b) => a.mapRank! - b.mapRank!);
  mid.rank = p.mapRank;
  mid.top3 = ranked.slice(0, 3).map((x) => x.name);
  return { id: `pscan_${p.id}`, keywordId: m.keyword, date: "2026-10-29", size, radiusMi: 3, points };
}

export const suggestedSearches = [
  { keyword: "plumber", city: "Austin, TX" },
  { keyword: "emergency dentist", city: "Austin, TX" },
  { keyword: "roofing contractor", city: "Round Rock, TX" },
  { keyword: "hvac repair", city: "Cedar Park, TX" },
  { keyword: "personal injury lawyer", city: "Austin, TX" },
];

/** Where each field comes from in the real build. DataForSEO covers the market
 * and the business; contact enrichment needs a couple of partner APIs. */
export const prospectSources: { group: string; items: { what: string; api: string; partner?: boolean }[] }[] = [
  { group: "Finding businesses", items: [
    { what: "Businesses with no website: category + radius, filtered to listings where url is null", api: "Business Data · business_listings/search · filters [\"url\", \"=\", null]" },
    { what: "One named business for a direct audit (name + city, or a Maps link)", api: "Business Data · google/my_business_info" },
    { what: "Map pack & local finder ranks for a keyword at a lat/lng", api: "SERP API · google/maps, google/local_finder" },
    { what: "Every business in a category + radius, with filters (no website, unclaimed, rating, photos…)", api: "Business Data · business_listings/search" },
    { what: "Google categories list", api: "Business Data · business_listings/categories" },
  ]},
  { group: "Profile", items: [
    { what: "Hours, attributes, photos, claimed status, place_id / CID", api: "Business Data · google/my_business_info" },
    { what: "Reviews, owner replies, review velocity", api: "Business Data · google/reviews" },
    { what: "Posts and Q&A activity", api: "Business Data · google/my_business_updates, questions_and_answers" },
  ]},
  { group: "Website & marketing", items: [
    { what: "Speed, mobile, HTTPS, schema, titles", api: "On-Page · instant_pages, lighthouse" },
    { what: "Emails, phones and social links on the site", api: "On-Page · content_parsing" },
    { what: "CMS, analytics, ad pixels, chat widget", api: "Domain Analytics · technologies" },
    { what: "Domain age and registrant", api: "Domain Analytics · whois/overview" },
    { what: "Organic traffic and ranking keywords", api: "Labs · domain_rank_overview" },
    { what: "Google Ads activity", api: "SERP API · google/ads_advertisers, ads_search" },
    { what: "Referring domains", api: "Backlinks · summary" },
  ]},
  { group: "Contact enrichment", items: [
    { what: "Mobile / landline / VoIP and SMS-capable", api: "Twilio Lookup · line_type_intelligence", partner: true },
    { what: "Email verification", api: "ZeroBounce or Hunter verifier", partner: true },
    { what: "Owner name and title", api: "Site About page, review reply signatures, state business filings (OpenCorporates)", partner: true },
  ]},
];

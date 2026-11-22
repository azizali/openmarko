// The stub's made-up market: a dozen dental practices around South Congress in Austin, the directories that rank
// beside them, and how each would show for a keyword or a question. Deterministic (the same question gives the same
// answer), so tests can assert on it and the app looks alive without a provider.
//
// In stub mode every Location lives here: finding a business offers these, and every search is answered from them.
// Results still move between checks a little (`round`), so the charts have something to show.

import type {
  AiQuery,
  AiResult,
  Coordinates,
  KeywordIdea,
  KeywordMetric,
  MapsItem,
  MapsQuery,
  OrganicQuery,
  OrganicResult,
  PlaceCandidate,
} from "./contract";

type Biz = {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  domain: string | null;
  category: string;
  categories: string[];
  rating: number;
  reviews: number;
  /** What it's known for: keywords and questions with these words favour it. */
  services: string[];
  address: string;
  phone: string;
};

const CITY = { name: "Austin", country: "US", timezone: "America/Chicago" };

export const stubBusinesses: Biz[] = [
  {
    slug: "maple-main",
    name: "Maple & Main Dental",
    lat: 30.2509,
    lng: -97.7497,
    domain: "mapleandmaindental.com",
    category: "Dentist",
    categories: ["Dentist", "Cosmetic dentist"],
    rating: 4.7,
    reviews: 212,
    services: ["family", "whitening", "cosmetic", "kids", "saturday", "gentle", "nervous"],
    address: "1204 S Congress Ave, Austin, TX 78704",
    phone: "(512) 555-0142",
  },
  {
    slug: "bright-smile",
    name: "Bright Smile Austin",
    lat: 30.2585,
    lng: -97.7612,
    domain: "brightsmileaustin.com",
    category: "Dentist",
    categories: ["Dentist", "Emergency dental service", "Teeth whitening service", "Cosmetic dentist"],
    rating: 4.9,
    reviews: 538,
    services: ["emergency", "whitening", "invisalign", "cosmetic", "veneers"],
    address: "1600 Barton Springs Rd, Austin, TX 78704",
    phone: "(512) 555-0188",
  },
  {
    slug: "congress-ave",
    name: "Congress Ave Dental",
    lat: 30.2402,
    lng: -97.7521,
    domain: "congressavedental.com",
    category: "Dentist",
    categories: ["Dentist", "Emergency dental service"],
    rating: 4.6,
    reviews: 341,
    services: ["emergency", "new patients", "insurance", "same day"],
    address: "2510 S Congress Ave, Austin, TX 78704",
    phone: "(512) 555-0117",
  },
  {
    slug: "barton-creek",
    name: "Barton Creek Family Dentistry",
    lat: 30.2632,
    lng: -97.7801,
    domain: "bartoncreekfamilydentistry.com",
    category: "Family dentist",
    categories: ["Family dentist", "Pediatric dentist", "Emergency dental service"],
    rating: 4.8,
    reviews: 289,
    services: ["kids", "family", "children", "gentle", "nervous", "invisalign"],
    address: "3801 S Lamar Blvd, Austin, TX 78704",
    phone: "(512) 555-0163",
  },
  {
    slug: "south-lamar",
    name: "South Lamar Dental Studio",
    lat: 30.2468,
    lng: -97.7783,
    domain: "southlamardental.com",
    category: "Cosmetic dentist",
    categories: ["Cosmetic dentist", "Dental implants provider"],
    rating: 4.5,
    reviews: 176,
    services: ["implants", "veneers", "cosmetic", "price"],
    address: "2300 S Lamar Blvd, Austin, TX 78704",
    phone: "(512) 555-0199",
  },
  {
    slug: "zilker",
    name: "Zilker Dental Co.",
    lat: 30.2661,
    lng: -97.7684,
    domain: "zilkerdental.co",
    category: "Dentist",
    categories: ["Dentist", "Teeth whitening service", "Dental implants provider"],
    rating: 4.7,
    reviews: 204,
    services: ["whitening", "implants", "cosmetic"],
    address: "2000 S 1st St, Austin, TX 78704",
    phone: "(512) 555-0121",
  },
  {
    slug: "bouldin",
    name: "Bouldin Creek Dental",
    lat: 30.2553,
    lng: -97.7562,
    domain: "bouldincreekdental.com",
    category: "Dentist",
    categories: ["Dentist"],
    rating: 4.9,
    reviews: 87,
    services: ["gentle", "family"],
    address: "1500 S 1st St, Austin, TX 78704",
    phone: "(512) 555-0174",
  },
  {
    slug: "travis-heights",
    name: "Travis Heights Smiles",
    lat: 30.2449,
    lng: -97.7389,
    domain: "travisheightssmiles.com",
    category: "Dentist",
    categories: ["Dentist", "Orthodontist"],
    rating: 4.4,
    reviews: 132,
    services: ["invisalign", "braces", "kids"],
    address: "1700 S Congress Ave, Austin, TX 78704",
    phone: "(512) 555-0135",
  },
  {
    slug: "st-elmo",
    name: "St. Elmo Dental Care",
    lat: 30.2214,
    lng: -97.7605,
    domain: null,
    category: "Dentist",
    categories: ["Dentist"],
    rating: 4.2,
    reviews: 58,
    services: ["insurance", "new patients"],
    address: "4400 S Congress Ave, Austin, TX 78745",
    phone: "(512) 555-0110",
  },
  {
    slug: "downtown-dental",
    name: "Downtown Austin Dental",
    lat: 30.2687,
    lng: -97.7431,
    domain: "downtownaustindental.com",
    category: "Dentist",
    categories: ["Dentist", "Emergency dental service", "Cosmetic dentist"],
    rating: 4.6,
    reviews: 455,
    services: ["emergency", "same day", "cosmetic", "saturday"],
    address: "600 Congress Ave, Austin, TX 78701",
    phone: "(512) 555-0150",
  },
  {
    slug: "aspen-south",
    name: "Aspen Dental — South Austin",
    lat: 30.2001,
    lng: -97.7902,
    domain: "aspendental.com",
    category: "Dentist",
    categories: ["Dentist", "Denture care center", "Dental implants provider"],
    rating: 4.3,
    reviews: 911,
    services: ["implants", "dentures", "price", "insurance", "new patients"],
    address: "4301 W William Cannon Dr, Austin, TX 78749",
    phone: "(512) 555-0102",
  },
  {
    slug: "kids-dentistry",
    name: "Austin Kids Dentistry",
    lat: 30.2389,
    lng: -97.7699,
    domain: "austinkidsdentistry.com",
    category: "Pediatric dentist",
    categories: ["Pediatric dentist"],
    rating: 4.9,
    reviews: 633,
    services: ["kids", "children", "gentle", "nervous"],
    address: "2700 W Anderson Ln, Austin, TX 78757",
    phone: "(512) 555-0191",
  },
];

/** Directories and publishers that rank beside the businesses and that AI answers cite. */
const directories = [
  { domain: "yelp.com", title: "THE BEST 10 Dentists in Austin, TX", weight: 3.2 },
  { domain: "healthgrades.com", title: "Best Dentists in Austin, TX", weight: 2.6 },
  { domain: "zocdoc.com", title: "Dentists in Austin, TX: book online", weight: 2.3 },
  { domain: "reddit.com", title: "r/Austin: good dentist recommendations?", weight: 1.9 },
  { domain: "austinchronicle.com", title: "Best of Austin: Dentist", weight: 1.2 },
  { domain: "opencare.com", title: "Top dentists near you in Austin", weight: 1.4 },
];

export const stubPlaceId = (b: Biz) => `stub_place_${b.slug}`;
const cidOf = (b: Biz) => String(1_000_000 + Math.floor(hash(b.slug) * 8_999_999));

// ---------- Deterministic numbers ----------

/** A number in [0, 1) from a string (FNV-1a). */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

/** Which weekly check this is, so results drift between checks but not within one. */
const round = (now = Date.now()) => Math.floor(now / (7 * 86_400_000));

const km = (a: Coordinates, b: Coordinates) => {
  const dLat = (a.lat - b.lat) * 111;
  const dLng = (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
};

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);

/** How well a business fits a search: shared words with what it's known for. */
function affinity(b: Biz, text: string): number {
  const w = new Set(words(text));
  let n = 0;
  for (const s of b.services) if (words(s).every((x) => w.has(x) || w.has(`${x}s`))) n++;
  for (const c of b.categories) if (words(c).some((x) => x !== "dentist" && x !== "service" && w.has(x))) n += 0.5;
  return n;
}

const prominence = (b: Biz) => b.rating * 0.8 + Math.log10(b.reviews + 1);

// ---------- Answers ----------

export function stubMaps(q: MapsQuery, now = Date.now()): MapsItem[] {
  const r = round(now);
  return stubBusinesses
    .map((b) => {
      const noise = hash(`${q.keyword}|${b.slug}|${r}`) * 1.6;
      // Distance counts most: Maps favours what's near the person searching.
      const score = prominence(b) + affinity(b, q.keyword) * 1.4 + noise - km(q.at, b) * 1.15;
      return { b, score };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, q.depth)
    .map(({ b }, i) => ({
      position: i + 1,
      placeId: stubPlaceId(b),
      cid: cidOf(b),
      name: b.name,
      domain: b.domain,
      category: b.category,
      categories: b.categories,
      rating: b.rating,
      // Reviews grow a little each week, so new reviews a month can be read off two snapshots.
      reviewCount: b.reviews + Math.floor(r % 52) * Math.max(1, Math.round(b.reviews / 90)),
      isClaimed: b.slug !== "st-elmo",
      address: b.address,
      lat: b.lat,
      lng: b.lng,
      phone: b.phone,
    }));
}

export function stubOrganic(q: OrganicQuery, now = Date.now()): OrganicResult {
  const r = round(now);
  const pool = [
    ...stubBusinesses
      .filter((b) => b.domain)
      .map((b) => ({
        domain: b.domain!,
        title: `${b.name} | ${b.category} in Austin`,
        url: `https://${b.domain}/`,
        score: prominence(b) * 0.6 + affinity(b, q.keyword) * 1.2,
      })),
    ...directories.map((d) => ({
      domain: d.domain,
      title: d.title,
      url: `https://www.${d.domain}/search?q=${encodeURIComponent(q.keyword)}`,
      score: d.weight + 2,
    })),
  ];
  const items = pool
    .map((p) => ({ ...p, score: p.score + hash(`${q.keyword}|${p.domain}|${r}`) * 2.2 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(q.depth, pool.length))
    .map((p, i) => ({ position: i + 1, domain: p.domain, url: p.url, title: p.title }));
  const local = !/\bhow|what|why\b/.test(q.keyword);
  const overview = hash(`aio|${q.keyword}`) > 0.45;
  return {
    items,
    mapPack: local,
    aiOverview: { shown: overview, citedDomains: overview ? items.slice(0, 3).map((i) => i.domain) : [] },
    peopleAlsoAsk: peopleAlsoAsk(q.keyword),
  };
}

function peopleAlsoAsk(keyword: string): string[] {
  const topic = keyword.replace(/\b(austin|near me|tx)\b/gi, "").trim() || "a dentist";
  return [
    `How much does ${topic} cost in Austin?`,
    `What should I look for in ${topic.startsWith("a ") ? topic : `a ${topic}`}?`,
    `Is ${topic} covered by insurance?`,
  ];
}

export function stubAi(q: AiQuery, now = Date.now()): AiResult {
  const r = round(now);
  const ranked = stubBusinesses
    .map((b) => ({
      b,
      score: prominence(b) * 0.7 + affinity(b, q.question) * 1.8 + hash(`${q.engine}|${q.question}|${b.slug}|${r}`) * 2.4,
    }))
    .sort((a, b) => b.score - a.score);
  const count = 2 + Math.floor(hash(`${q.engine}|${q.question}`) * 2);
  const named = ranked.slice(0, count).map((x) => x.b);
  const cites = [...directories]
    .sort((a, b) => hash(`${q.engine}|${b.domain}|${q.question}`) - hash(`${q.engine}|${a.domain}|${q.question}`))
    .slice(0, 2)
    .map((d) => d.domain);
  if (named[0]?.domain && hash(`site|${q.engine}|${q.question}`) > 0.5) cites.push(named[0].domain);
  const [a, b, c] = named;
  const text =
    `Several Austin practices are well reviewed for this. ${a!.name} is the name that comes up most, ` +
    `with ${a!.rating.toFixed(1)} stars from ${a!.reviews} reviews.` +
    (b ? ` ${b.name} is also often recommended${b.services[0] ? `, especially for ${b.services[0]} care` : ""}.` : "") +
    (c ? ` ${c.name} is another option worth a look.` : "") +
    " Check current availability before you book.";
  return { text, citations: cites.map((d) => ({ domain: d, url: `https://${d}/` })) };
}

export function stubPlaces(query: string, near?: Coordinates | null): PlaceCandidate[] {
  const w = words(query).filter((x) => x.length > 2);
  const matches = stubBusinesses.filter((b) => w.some((x) => words(`${b.name} ${b.domain ?? ""} ${b.address}`).includes(x)));
  const list = (matches.length ? matches : stubBusinesses).slice();
  if (near) list.sort((a, b) => km(near, a) - km(near, b));
  return list.slice(0, 5).map((b) => ({
    placeId: stubPlaceId(b),
    name: b.name,
    address: b.address,
    lat: b.lat,
    lng: b.lng,
    countryCode: CITY.country,
    city: CITY.name,
    timezone: CITY.timezone,
    website: b.domain ? `https://${b.domain}/` : null,
    phone: b.phone,
    category: b.category,
    rating: b.rating,
    reviewCount: b.reviews,
  }));
}

export function stubVolume(term: string): KeywordMetric {
  const t = term.toLowerCase();
  const base = /near me/.test(t) ? 20_000 : /austin/.test(t) ? 900 : 300;
  const monthly = Math.round((base * (0.4 + hash(`vol|${t}`) * 2.2)) / 10) * 10;
  return {
    term,
    monthlySearches: monthly,
    cpc: Math.round(hash(`cpc|${t}`) * 1200) / 100 + 1,
    competition: Math.round(hash(`comp|${t}`) * 100) / 100,
    trend: Array.from({ length: 12 }, (_, i) => Math.round(monthly * (0.85 + 0.3 * hash(`trend|${t}|${i}`)))),
  };
}

const ideaTopics = [
  "emergency dentist",
  "teeth whitening",
  "invisalign",
  "dental implants",
  "kids dentist",
  "family dentist",
  "root canal",
  "veneers",
  "dentist open saturday",
  "cosmetic dentist",
];

export function stubIdeas(domain: string | null, seeds: string[], limit: number): KeywordIdea[] {
  const biz = stubBusinesses.find((b) => b.domain && b.domain === domain);
  const topics = biz ? ideaTopics.filter((t) => affinity(biz, t) > 0 || hash(`${biz.slug}|${t}`) > 0.6) : ideaTopics;
  const terms = [...new Set([...topics.map((t) => `${t} austin`), ...seeds.map((s) => s.toLowerCase().trim()).filter(Boolean)])];
  return terms.slice(0, limit).map((term) => ({
    term,
    monthlySearches: stubVolume(term).monthlySearches,
    position: domain ? (hash(`pos|${domain}|${term}`) > 0.3 ? 1 + Math.floor(hash(`p|${domain}|${term}`) * 40) : null) : null,
  }));
}

/**
 * Who the homepage is about. By default it follows one example business: a plumber in Austin.
 * The trade comes from the picker, the city from the visitor's IP, and a name only if they type one.
 * Until they name their business, the page follows an example business in their trade and city.
 * It is a preview of the work, never their real rankings; the free audit is where real data comes from.
 */

export type TradeId = "plumber" | "hvac" | "roofer" | "electrician" | "dentist" | "medspa" | "lawfirm" | "autorepair" | "other";

export type Trade = {
  id: TradeId;
  /** In the picker and on the map listing. */
  label: string;
  /** What customers type into Google. */
  search: string;
  plural: string;
  /** With its article, for prose: "Ask ChatGPT for a plumber near you". */
  one: string;
  /** Without the article, for "one plumber in Austin". */
  noun: string;
  /** The business the page follows until the visitor names their own. */
  example: string;
  /** The vague phrase agencies write pages about. */
  generic: string;
  category: string;
  hours: string;
  services: [string, string, string, string];
  /** The service page Marko drafts in the local pages panel. */
  pageService: string;
  /** The Google category a rival just added. */
  newCategory: string;
  /** A supplier or directory that links to businesses in this trade. */
  supplier: string;
  /** The AI question, completed with a place: "Who's the best emergency plumber near …?" */
  aiAsk: string;
  review: { text: string; reply: string };
  rivals: (city: string) => [string, string, string];
};

export const trades: Trade[] = [
  {
    id: "plumber", label: "Plumber", noun: "plumber", example: "Carter Plumbing & Drain", search: "plumber", plural: "plumbers", one: "a plumber", generic: "plumbing services",
    category: "Plumber", hours: "Open 24 hours", services: ["Water heaters", "Drain cleaning", "Leak repair", "Repiping"],
    pageService: "Water heater repair", newCategory: "Water heater installation", supplier: "Rheem Pro Partner finder",
    aiAsk: "Who's the best emergency plumber near",
    review: {
      text: "Luis showed up within the hour on a Sunday and had our water heater working again by lunch. Fair price, cleaned up after himself.",
      reply: "Thanks Jordan! A Sunday water-heater emergency is no fun, so we're glad Luis got you sorted before lunch. We'll pass your kind words on to him.",
    },
    rivals: (c) => [`${c} Plumbing Co.`, "Northside Drain & Sewer", "AllPro Rooter"],
  },
  {
    id: "hvac", label: "HVAC", noun: "AC repair company", example: "Summit Air & Heat", search: "ac repair", plural: "HVAC companies", one: "an AC repair company", generic: "heating and cooling services",
    category: "HVAC contractor", hours: "Open 24 hours", services: ["AC repair", "Furnace repair", "Heat pumps", "Duct cleaning"],
    pageService: "AC repair", newCategory: "Air duct cleaning service", supplier: "Carrier dealer locator",
    aiAsk: "Who's the best emergency AC repair near",
    review: {
      text: "Our AC died in a heat wave and they had a tech here the same afternoon. Explained everything and didn't upsell.",
      reply: "Thanks Jordan! Nobody should sit through a heat wave without AC. Glad we got you cool again the same day.",
    },
    rivals: (c) => [`${c} Heating & Air`, "Comfort Pro HVAC", "Northside Air Co."],
  },
  {
    id: "roofer", label: "Roofer", noun: "roofer", example: "Alvarez Roofing", search: "roofer", plural: "roofers", one: "a roofer", generic: "roofing services",
    category: "Roofing contractor", hours: "Open until 6 PM", services: ["Roof repair", "Roof replacement", "Storm damage", "Gutters"],
    pageService: "Roof repair", newCategory: "Gutter cleaning service", supplier: "GAF contractor finder",
    aiAsk: "Who's the best roofer near",
    review: {
      text: "After the hailstorm they inspected the roof the next morning, handled the insurance photos and had it patched in two days.",
      reply: "Thanks Jordan! Storm season is stressful, so we're glad we could get your roof sorted fast.",
    },
    rivals: (c) => [`${c} Roofing`, "Summit Roof Co.", "Ridgeline Exteriors"],
  },
  {
    id: "electrician", label: "Electrician", noun: "electrician", example: "Keller Electric", search: "electrician", plural: "electricians", one: "an electrician", generic: "electrical services",
    category: "Electrician", hours: "Open 24 hours", services: ["Panel upgrades", "EV chargers", "Lighting", "Rewiring"],
    pageService: "EV charger installation", newCategory: "Lighting contractor", supplier: "Generac dealer locator",
    aiAsk: "Who's the best electrician near",
    review: {
      text: "They installed our EV charger in one visit, pulled the permit themselves and left the garage cleaner than they found it.",
      reply: "Thanks Jordan! Enjoy the new charger, and thanks for trusting us with the permit work.",
    },
    rivals: (c) => [`${c} Electric`, "Brightwire Electrical", "Volt Pros"],
  },
  {
    id: "dentist", label: "Dentist", noun: "dentist", example: "Maple & Main Dental", search: "dentist", plural: "dentists", one: "a dentist", generic: "dental services",
    category: "Dentist", hours: "Open until 5 PM", services: ["Cleanings", "Implants", "Invisalign", "Emergency visits"],
    pageService: "Emergency dental care", newCategory: "Cosmetic dentist", supplier: "Invisalign doctor locator",
    aiAsk: "Who's the best emergency dentist near",
    review: {
      text: "Cracked a tooth on a Saturday and they fit me in that morning. Gentle, clear about the cost, no lecture.",
      reply: "Thanks Jordan! A cracked tooth on a weekend is no fun. We're glad we could see you the same morning.",
    },
    rivals: (c) => [`${c} Family Dental`, "Parkview Smiles", "Brightline Dental"],
  },
  {
    id: "medspa", label: "Med spa", noun: "med spa", example: "Lakeline Med Spa", search: "med spa", plural: "med spas", one: "a med spa", generic: "aesthetic services",
    category: "Medical spa", hours: "Open until 7 PM", services: ["Botox", "Fillers", "Laser hair removal", "Facials"],
    pageService: "Botox", newCategory: "Laser hair removal service", supplier: "Allergan provider finder",
    aiAsk: "What's the best med spa near",
    review: {
      text: "Honest consult, no pressure, and the results look natural. Booking was easy and they texted a reminder.",
      reply: "Thanks Jordan! Natural results are exactly what we aim for. See you at your next visit.",
    },
    rivals: (c) => [`${c} Aesthetics`, "Glow Medical Spa", "Luxe Skin Studio"],
  },
  {
    id: "lawfirm", label: "Law firm", noun: "injury lawyer", example: "Reyes Injury Law", search: "injury lawyer", plural: "injury lawyers", one: "an injury lawyer", generic: "legal services",
    category: "Personal injury attorney", hours: "Open until 6 PM", services: ["Car accidents", "Truck accidents", "Workers' comp", "Slip and fall"],
    pageService: "Car accident lawyer", newCategory: "Workers' compensation attorney", supplier: "State Bar lawyer referral",
    aiAsk: "Who's the best personal injury lawyer near",
    review: {
      text: "They called me back the same day, explained my options in plain English and never made me feel rushed.",
      reply: "Thanks Jordan! We know how stressful this is, and we're glad we could make it clearer.",
    },
    rivals: (c) => [`${c} Injury Law`, "Hartley & Moss", "Summit Legal Group"],
  },
  {
    id: "autorepair", label: "Auto repair", noun: "auto repair shop", example: "Main Street Auto", search: "auto repair", plural: "auto repair shops", one: "an auto repair shop", generic: "automotive services",
    category: "Auto repair shop", hours: "Open until 6 PM", services: ["Brakes", "Oil changes", "Diagnostics", "Transmissions"],
    pageService: "Brake repair", newCategory: "Brake shop", supplier: "NAPA AutoCare finder",
    aiAsk: "Who's the best auto repair shop near",
    review: {
      text: "Check-engine light on a road trip. They diagnosed it in an hour, showed me the part and charged what they quoted.",
      reply: "Thanks Jordan! Glad we could get you back on the road the same day.",
    },
    rivals: (c) => [`${c} Auto Care`, "Precision Auto Works", "Northside Garage"],
  },
  {
    id: "other", label: "Other", noun: "local business", example: "Main Street Co.", search: "near me", plural: "local businesses", one: "a local business", generic: "our services",
    category: "Local business", hours: "Open until 6 PM", services: ["Consultations", "Installations", "Repairs", "Maintenance"],
    pageService: "Same-day service", newCategory: "Service establishment", supplier: "Local business directory",
    aiAsk: "Who's the most trusted local business near",
    review: {
      text: "Called in the morning and they had it sorted by the afternoon. Clear price, friendly team, would use them again.",
      reply: "Thanks Jordan! Same-day is what we aim for, and we're glad we could help.",
    },
    rivals: (c) => [`${c} Pros`, "Northside Services", "AllCity Co."],
  },
];

export const tradeById = (id: TradeId) => trades.find((t) => t.id === id) ?? trades[0];

/** What the visitor typed. Empty strings mean "use the sample". */
export type PersonaInput = { name: string; city: string; trade: TradeId };
export const emptyInput: PersonaInput = { name: "", city: "", trade: "plumber" };

export type Listing = { name: string; short: string; rating: number; reviews: number; domain: string; title: string; snippet: string };

export type Persona = {
  /** True while the page follows the default example: a plumber in Austin, no name typed. */
  isSample: boolean;
  /** The visitor typed their own business name. */
  named: boolean;
  /** The city is the visitor's (from IP or typed), not Austin. */
  located: boolean;
  name: string;
  city: string;
  trade: Trade;
  domain: string;
  keyword: string;
  you: Listing;
  rivals: [Listing, Listing, Listing];
  /** Four areas for the service-page grid; the first is the city. */
  towns: [string, string, string, string];
  /** The place in the AI question. */
  near: string;
  /** The local page Marko drafted. */
  pageTitle: string;
  /** What the top rival did this week. */
  rivalMove: string;
  links: { site: string; why: string; has: string; state: "Draft ready" | "Sent" | "Idea" }[];
};

const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
const titleCase = (s: string) => s.trim().replace(/\s+/g, " ").replace(/\b\p{L}/gu, (c) => c.toUpperCase());

const sample: Persona = {
  isSample: true,
  named: false,
  located: false,
  name: "Carter Plumbing & Drain",
  city: "Austin",
  trade: trades[0],
  domain: "carterplumbing.com",
  keyword: "plumber austin",
  you: { name: "Carter Plumbing & Drain", short: "Carter", rating: 4.8, reviews: 212, domain: "carterplumbing.com", title: "Plumber in Austin, TX | Carter Plumbing & Drain", snippet: "24/7 emergency plumber in Austin and Round Rock. Water heaters, drains, leaks. 4.8★ from 212 reviews." },
  rivals: [
    { name: "Lone Star Plumbing", short: "Lone Star", rating: 4.6, reviews: 318, domain: "lonestarplumbing.com", title: "Lone Star Plumbing | Austin Plumbers Since 1998", snippet: "Licensed plumbers serving Austin and Travis County. Drains, water heaters, repiping." },
    { name: "Capitol Drain Co.", short: "Capitol Drain", rating: 4.5, reviews: 204, domain: "capitoldrain.com", title: "Drain Cleaning & Plumbing in Austin, TX", snippet: "Same-week drain cleaning and sewer camera inspections across central Austin." },
    { name: "Eastside Rooter", short: "Eastside Rooter", rating: 4.3, reviews: 97, domain: "eastsiderooter.com", title: "Eastside Rooter | 24/7 Plumber", snippet: "Emergency plumbing and rooter service, east Austin and Manor." },
  ],
  towns: ["Austin", "Round Rock", "Pflugerville", "Cedar Park"],
  near: "Hyde Park, Austin",
  pageTitle: "Water Heater Repair in Round Rock, TX",
  rivalMove: "Lone Star added the “Water heater installation” category and a Round Rock page",
  links: [
    { site: "Round Rock Chamber of Commerce", why: "Member directory", has: "Lone Star, Capitol Drain", state: "Draft ready" },
    { site: "Rheem Pro Partner finder", why: "Supplier dealer page", has: "Lone Star", state: "Draft ready" },
    { site: "Cedar Park Little League", why: "Sponsor page", has: "Capitol Drain", state: "Sent" },
    { site: "Community Impact Austin", why: "Local news tip", has: "", state: "Idea" },
  ],
};

/** Each blank field falls back: no name means the trade's example business, no city means Austin. */
export function resolvePersona(input: PersonaInput): Persona {
  const name = input.name.trim().replace(/\s+/g, " ");
  const city = titleCase(input.city);
  if (!name && !city && input.trade === "plumber") return sample;
  const trade = tradeById(input.trade);
  const n = name || trade.example;
  const c = city || sample.city;
  const domain = name ? (/^\S+\.\S+$/.test(name) ? name.toLowerCase() : `${slug(name)}.com`) : trade.id === "plumber" ? sample.domain : `${slug(n)}.com`;
  const [r1, r2, r3] = trade.rivals(c);
  const listing = (rn: string, rating: number, reviews: number): Listing => ({
    name: rn, short: rn.replace(/ (Co\.|Inc\.|Group|Law)$/, ""), rating, reviews, domain: `${slug(rn)}.com`,
    title: `${rn} | ${trade.category} in ${c}`, snippet: `Serving ${c} and nearby. ${trade.services.slice(0, 3).join(", ")}.`,
  });
  const rivals: Persona["rivals"] = [listing(r1, 4.6, 318), listing(r2, 4.5, 204), listing(r3, 4.3, 97)];
  return {
    isSample: false,
    named: !!name,
    located: !!city,
    name: n,
    city: c,
    trade,
    domain,
    keyword: trade.id === "other" ? `local business ${c.toLowerCase()}` : `${trade.search} ${c.toLowerCase()}`,
    you: { name: n, short: n, rating: 4.8, reviews: 212, domain, title: `${trade.category} in ${c} | ${n}`, snippet: `${trade.services[0]}, ${trade.services[1].toLowerCase()} and more across ${c}. 4.8★ from 212 reviews.` },
    rivals,
    towns: [c, "Northside", "Eastside", "Westside"],
    near: `downtown ${c}`,
    pageTitle: `${trade.pageService} in Northside, ${c}`,
    rivalMove: `${rivals[0].short} added the “${trade.newCategory}” category and a Northside page`,
    links: [
      { site: `${c} Chamber of Commerce`, why: "Member directory", has: `${rivals[0].short}, ${rivals[1].short}`, state: "Draft ready" },
      { site: trade.supplier, why: "Supplier listing", has: rivals[0].short, state: "Draft ready" },
      { site: `${c} youth sports league`, why: "Sponsor page", has: rivals[1].short, state: "Sent" },
      { site: `${c} local news`, why: "Local news tip", has: "", state: "Idea" },
    ],
  };
}

export const samplePersona = sample;

/** Fills `{one}`, `{search}`, `{service}`, `{town}` and `{generic}` in page copy. The sample reads exactly as the copy was written. */
export function fill(s: string, me: Persona) {
  return s
    .replaceAll("{one}", me.trade.one)
    .replaceAll("{search}", me.trade.id === "other" ? "local business" : me.trade.search)
    .replaceAll("{service}", me.trade.pageService.toLowerCase())
    .replaceAll("{town}", me.isSample ? me.towns[1] : me.city)
    .replaceAll("{generic}", me.trade.generic);
}

// How to fix each kind of audit issue: steps in plain words and, where the business's own facts are enough, the
// thing to paste (local business markup, robots.txt lines, an llms.txt). Pure, like issues.ts. The site is the
// customer's own; nothing here changes it. A fix is done by hand and checked by the next audit.

import type { IssueCode } from "./issues";

/** The business as the fix needs it, from its Location and Google profile. */
export type FixFacts = {
  name: string;
  /** The site's home page. */
  url: string;
  address: string | null;
  phone: string | null;
  lat: number;
  lng: number;
  category: string | null;
  services: string[];
};

export type Fix = {
  steps: string[];
  /** Something to paste, ready-made from the business's facts. */
  snippet: { label: string; text: string } | null;
};

/** schema.org's own types for common Google categories; anything else is a LocalBusiness. */
const schemaTypes: Record<string, string> = {
  dentist: "Dentist",
  "cosmetic dentist": "Dentist",
  "emergency dental service": "Dentist",
  orthodontist: "Dentist",
  restaurant: "Restaurant",
  cafe: "CafeOrCoffeeShop",
  "coffee shop": "CafeOrCoffeeShop",
  bakery: "Bakery",
  bar: "BarOrPub",
  plumber: "Plumber",
  electrician: "Electrician",
  locksmith: "Locksmith",
  "roofing contractor": "RoofingContractor",
  "hvac contractor": "HVACBusiness",
  "pest control service": "PestControl",
  lawyer: "LegalService",
  attorney: "LegalService",
  "real estate agency": "RealEstateAgent",
  "hair salon": "HairSalon",
  "beauty salon": "BeautySalon",
  "nail salon": "NailSalon",
  gym: "ExerciseGym",
  "auto repair shop": "AutoRepair",
  "car dealer": "AutoDealer",
  veterinarian: "VeterinaryCare",
  "medical clinic": "MedicalClinic",
  physician: "Physician",
  pharmacy: "Pharmacy",
  hotel: "Hotel",
  "insurance agency": "InsuranceAgency",
  accountant: "AccountingService",
};
export const schemaTypeFor = (category: string | null) => (category && schemaTypes[category.toLowerCase()]) || "LocalBusiness";

const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** Local business markup for the home page, from what the business's Location and Google profile say. */
export function localBusinessMarkup(f: FixFacts): string {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaTypeFor(f.category),
    name: f.name,
    url: f.url,
    ...(f.phone ? { telephone: f.phone } : {}),
    ...(f.address ? { address: { "@type": "PostalAddress", streetAddress: f.address } } : {}),
    geo: { "@type": "GeoCoordinates", latitude: Number(f.lat.toFixed(5)), longitude: Number(f.lng.toFixed(5)) },
  };
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
}

/** An llms.txt: who the business is and what it offers, in the format llmstxt.org proposes. */
export function llmsTxt(f: FixFacts): string {
  const lines = [
    `# ${f.name}`,
    "",
    `> ${f.category ?? "A local business"}${f.address ? ` at ${f.address}` : ""}.${f.phone ? ` Phone: ${f.phone}.` : ""}`,
    "",
    "## Services",
    "",
    ...(f.services.length ? f.services.map((s) => `- ${s}`) : ["- (list what you offer here)"]),
    "",
    "## Pages",
    "",
    `- [Home](${f.url})`,
  ];
  return `${lines.join("\n")}\n`;
}

/** The steps for one kind of issue, given what was found (`items`: the bots, phones or services it's about). */
export function fixFor(code: IssueCode, items: string[], f: FixFacts): Fix {
  switch (code) {
    case "no_local_schema":
      return {
        steps: [
          "Paste this into your home page's <head>, or into your site builder's custom code box for the home page.",
          "Check it with Google's Rich Results Test (search.google.com/test/rich-results).",
        ],
        snippet: { label: "Local business markup", text: localBusinessMarkup(f) },
      };
    case "phone_mismatch":
      return {
        steps: [
          `Your Google profile says ${f.phone}. Your home page shows ${list(items)}.`,
          `Change your site to ${f.phone} everywhere it appears: header, footer and contact page.`,
          "If the number on your site is the right one, change your Google profile instead.",
        ],
        snippet: null,
      };
    case "phone_missing":
      return {
        steps: [
          `Add ${f.phone ?? "your phone number"} to your home page, written as text (not only in an image), ideally in the header or footer.`,
        ],
        snippet: null,
      };
    case "service_without_page":
      return {
        steps: [
          `Write a page for each: ${list(items)}.`,
          "Say what it is, who it's for, roughly what it costs, and how to book. Put the service in the page's title and main heading.",
          "Link to each new page from your services page and home page.",
        ],
        snippet: null,
      };
    case "ai_bots_blocked":
      return {
        steps: [
          `Your robots.txt tells ${list(items)} to stay out. Remove the "Disallow: /" lines under their names.`,
          "Or, to say so plainly, add these lines. Changes count the next time each assistant visits.",
        ],
        snippet: { label: "robots.txt", text: items.map((b) => `User-agent: ${b}\nAllow: /`).join("\n\n") },
      };
    case "no_llms_txt":
      return {
        steps: ["Save this as llms.txt at the top of your site (so it opens at /llms.txt), then add your most useful pages under Pages."],
        snippet: { label: "llms.txt", text: llmsTxt(f) },
      };
    case "broken_page":
      return {
        steps: [
          "For each page: bring it back, or redirect it (301) to the closest page that works.",
          "Then change your own links that point at it.",
        ],
        snippet: null,
      };
    case "orphan_page":
      return { steps: ["Link to each page from a page about the same subject, or from your menu or services page."], snippet: null };
    case "deep_page":
      return {
        steps: ["Link to these pages from the home page, the menu or a main section page, so they're three clicks away or fewer."],
        snippet: null,
      };
    case "missing_title":
      return { steps: ["Give each page a title of about 50 to 60 characters: what the page is about, then your name."], snippet: null };
    case "duplicate_title":
      return {
        steps: [
          "Give each page a title that says what that page is about. Shared titles usually come from a blog or page template left as it was.",
        ],
        snippet: null,
      };
    case "missing_description":
      return {
        steps: ["Write one or two sentences per page (about 150 characters) that would make someone want to click."],
        snippet: null,
      };
    case "missing_h1":
      return { steps: ["Give each page one main heading that says what it's about."], snippet: null };
    case "thin_content":
      return { steps: ["Add what a customer would want to know: what it is, who it's for, prices, and common questions."], snippet: null };
    case "images_missing_alt":
      return { steps: ["Describe each image in a few words in its alt text: what it shows, not keywords."], snippet: null };
    case "slow_page":
      return {
        steps: [
          "Shrink large images (most sites' biggest win), and drop scripts and widgets you don't use.",
          "Test each page with PageSpeed Insights (pagespeed.web.dev) to see what slows it most.",
        ],
        snippet: null,
      };
  }
}

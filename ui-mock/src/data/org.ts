// The Organization and what it owns, in the words of GLOSSARY.md:
// Organization → Locations (each with a Google Business Profile), Websites,
// Accounts (data/social.ts) and Integrations. Most Organizations have one of
// each; every list here can hold many.

import { business, locations, member } from "./mock";

export type Organization = { id: string; name: string; category: string; initial: string };

export const organization: Organization = { id: "org_maple", name: business.name, category: "Dentist", initial: "M" };

/**
 * Every Organization the signed-in Member belongs to. An agency Member belongs
 * to each Client's Organization; there's no level above it.
 */
export const memberships: (Organization & { locations: number; role: string })[] = [
  { ...organization, locations: locations.length, role: "Owner" },
  ...(member.plan === "agency"
    ? [
      { id: "org_hill", name: "Hill Country Plumbing", category: "Plumber", initial: "H", locations: 1, role: "Agency" },
      { id: "org_east", name: "Eastside Yoga Collective", category: "Yoga studio", initial: "E", locations: 3, role: "Agency" },
    ]
    : []),
];

/** Adds a new Client's Organization to the switcher (mock: it has no data of its own yet). */
export function addMembership(name: string, category: string) {
  const id = `org_${Date.now().toString(36)}`;
  memberships.push({ id, name, category, initial: name.charAt(0).toUpperCase(), locations: 1, role: "Owner" });
  return id;
}

export type WebsiteTool = { name: "Search Console" | "Google Analytics 4" | "WordPress"; connected: boolean; detail: string };
export type Website = { id: string; domain: string; locationIds: string[]; tools: WebsiteTool[] };

export const websites: Website[] = [
  {
    id: "web_1", domain: business.website, locationIds: ["loc_1"],
    tools: [
      { name: "Search Console", connected: true, detail: `sc-domain:${business.website}` },
      { name: "Google Analytics 4", connected: false, detail: "Attributes calls and bookings to search" },
      { name: "WordPress", connected: true, detail: "Application password · Yoast detected" },
    ],
  },
  {
    id: "web_2", domain: "mapleandmainmueller.com", locationIds: ["loc_2"],
    tools: [
      { name: "Search Console", connected: true, detail: "sc-domain:mapleandmainmueller.com" },
      { name: "Google Analytics 4", connected: true, detail: "Property 418-220-913" },
      { name: "WordPress", connected: false, detail: "Squarespace site; changes are made by hand" },
    ],
  },
];

/** The Website serving a Location. */
export const websiteFor = (locationId: string) => websites.find((w) => w.locationIds.includes(locationId)) ?? websites[0];

export const shortLocation = (id?: string) => locations.find((l) => l.id === id)?.name.split(" — ")[1] ?? "";

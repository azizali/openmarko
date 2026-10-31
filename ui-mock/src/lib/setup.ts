// What the Organization has connected. Nothing is required to start: each
// feature checks only what it reads, and pages that need something missing show
// <Needs> (components/Needs.tsx) instead of their tools.
//
//   Location (name + address)  → Rankings, Competitors, Citations, AI answers (public data)
//   Google profile, per Location → Business Profile, Reviews, Google posts, calls & directions
//   Website, per Location        → Site health, Articles, Backlinks
//   A social Account             → Posts & calendar
//   nothing                      → Social scanner, Trending, Swipe file

import { useSyncExternalStore } from "react";
import { locations } from "../data/mock";
import { organization, websites } from "../data/org";
import { linkData, locationData, websiteData } from "../data/scoped";
import { accountOf, accounts } from "../data/social";

type Setup = {
  googleProfile: Record<string, boolean>; // by Location
  website: Record<string, boolean>; // by Website: added to the Organization
  account: Record<string, boolean>; // by Account: connected
};

let setup: Setup = {
  googleProfile: Object.fromEntries(locations.map((l) => [l.id, l.googleProfile === "connected"])),
  website: Object.fromEntries(websites.map((w) => [w.id, true])),
  account: Object.fromEntries(accounts.map((a) => [a.id, a.connected])),
};
const listeners = new Set<() => void>();
const set = (next: Setup) => { setup = next; listeners.forEach((l) => l()); };
export const useSetup = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => setup, () => setup);
export const getSetup = () => setup;

export const setGoogleProfile = (locationId: string, on: boolean) => set({ ...setup, googleProfile: { ...setup.googleProfile, [locationId]: on } });
export const setWebsite = (websiteId: string, on: boolean) => set({ ...setup, website: { ...setup.website, [websiteId]: on } });
export const setAccount = (accountId: string, on: boolean) => set({ ...setup, account: { ...setup.account, [accountId]: on } });

/** "1204 S Congress Ave, Austin, TX 78704" → "Austin, TX". */
const cityOf = (address: string) => address.split(",").slice(-2).join(",").replace(/\s+\d{5}(-\d{4})?$/, "").trim();

/**
 * Adds a Location to the Organization. Mock: it borrows Mueller's sample
 * reviews and insights until its own data comes in. Returns its id.
 */
export function addLocation(label: string, address: string, websiteId: string | null) {
  const id = `loc_${Date.now().toString(36)}`;
  locations.push({ id, name: `${organization.name} — ${label}`, city: cityOf(address), address, googleProfile: "none", keywords: 0 });
  locationData[id] = locationData.loc_2;
  const w = websites.find((x) => x.id === websiteId);
  if (w) w.locationIds.push(id);
  set({ ...setup, googleProfile: { ...setup.googleProfile, [id]: false } });
  return id;
}

/** Renames a Location, moves its address, or changes the Website serving it. */
export function updateLocation(id: string, label: string, address: string, websiteId: string | null) {
  const l = locations.find((x) => x.id === id);
  if (!l) return;
  l.name = `${organization.name} — ${label}`;
  l.address = address;
  l.city = cityOf(address);
  for (const w of websites) w.locationIds = w.locationIds.filter((x) => x !== id);
  websites.find((x) => x.id === websiteId)?.locationIds.push(id);
  set({ ...setup });
}

/**
 * Deletes a Location: its Google profile account goes with it, Websites stop
 * serving it, and social accounts tagged to it speak for the whole Organization
 * again. The last Location can't be deleted.
 */
export function removeLocation(id: string) {
  const i = locations.findIndex((x) => x.id === id);
  if (i < 0 || locations.length < 2) return;
  locations.splice(i, 1);
  for (const w of websites) w.locationIds = w.locationIds.filter((x) => x !== id);
  for (let j = accounts.length - 1; j >= 0; j--) {
    if (accounts[j].locationId !== id) continue;
    if (accounts[j].platform === "google") accounts.splice(j, 1);
    else delete accounts[j].locationId;
  }
  const { [id]: _, ...googleProfile } = setup.googleProfile;
  set({ ...setup, googleProfile });
}

/** Changes a Website's address or the Locations it serves. */
export function updateWebsite(id: string, domain: string, locationIds: string[]) {
  const w = websites.find((x) => x.id === id);
  if (!w) return;
  w.domain = domain;
  w.locationIds = locationIds;
  set({ ...setup });
}

/** Adds a Website serving `locationIds`. Mock: Mueller's crawl and links stand in until the first crawl. */
export function addWebsite(domain: string, locationIds: string[]) {
  const id = `web_${Date.now().toString(36)}`;
  websites.push({
    id, domain, locationIds,
    tools: [
      { name: "Search Console", connected: false, detail: "Rankings and clicks from Google search" },
      { name: "Google Analytics 4", connected: false, detail: "Attributes calls and bookings to search" },
      { name: "WordPress", connected: false, detail: "Lets fixes and articles go straight to the site" },
    ],
  });
  websiteData[id] = websiteData.web_2;
  linkData[id] = linkData.web_2;
  set({ ...setup, website: { ...setup.website, [id]: true } });
  return id;
}

export const hasGoogleProfile =(locationId: string, s = setup) => !!s.googleProfile[locationId];
/** The Website serving a Location, if the Organization has one. */
export const websiteOf = (locationId: string, s = setup) => websites.find((w) => w.locationIds.includes(locationId) && s.website[w.id]) ?? null;
/** A Google profile Account is connected when its Location's Google profile is. */
export const accountConnected = (accountId: string, s = setup) => {
  const a = accountOf(accountId);
  return a?.platform === "google" ? !!(a.locationId && s.googleProfile[a.locationId]) : !!s.account[accountId];
};

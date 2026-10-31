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
import { websites } from "../data/org";
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

export const hasGoogleProfile = (locationId: string, s = setup) => !!s.googleProfile[locationId];
/** The Website serving a Location, if the Organization has one. */
export const websiteOf = (locationId: string, s = setup) => websites.find((w) => w.locationIds.includes(locationId) && s.website[w.id]) ?? null;
/** A Google profile Account is connected when its Location's Google profile is. */
export const accountConnected = (accountId: string, s = setup) => {
  const a = accountOf(accountId);
  return a?.platform === "google" ? !!(a.locationId && s.googleProfile[a.locationId]) : !!s.account[accountId];
};

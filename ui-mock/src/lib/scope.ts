// The Scope the app is showing: the current Organization, and either all of its
// Locations or one. Module store so the switcher and pages agree.

import { useSyncExternalStore } from "react";
import { organization, websiteFor, websites } from "../data/org";
import { locations } from "../data/mock";

type Scope = { orgId: string; locationId: string | null }; // null = all Locations
let scope: Scope = { orgId: organization.id, locationId: null };
const listeners = new Set<() => void>();
export const useScope = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => scope, () => scope);
export const setScope = (patch: Partial<Scope>) => { scope = { ...scope, ...patch }; listeners.forEach((l) => l()); };

/**
 * The Location a Location page should show. `location` is null when the Scope is
 * "All locations" and there's more than one; with a single Location it's always that one.
 */
export function useScopedLocation() {
  const { locationId } = useScope();
  const location = locations.find((l) => l.id === locationId) ?? (locations.length === 1 ? locations[0] : null);
  return { location, multi: locations.length > 1 };
}

/** The Website a Website page should show: the one serving the scoped Location, or null for "all". */
export function useScopedWebsite() {
  const { location, multi } = useScopedLocation();
  const website = location ? websiteFor(location.id) : websites.length === 1 ? websites[0] : null;
  return { website, multi: websites.length > 1 || multi };
}

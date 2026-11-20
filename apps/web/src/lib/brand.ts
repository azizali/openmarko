// The brand on screen: ours, or a Partner's (whitelabel, ADR 0004). The Organization being worked in decides.
// Fetched before the first render, so the name, accent and title don't flash ours,
// and again when the Organization or its brand changes. Without the partners module, ours.
import { useSyncExternalStore } from "react";
import { APP_NAME, modules } from "./modules";

export type Brand = { name: string; assistant: string; accent: string; logo: string | null; whitelabel: boolean };

const ours: Brand = { name: APP_NAME, assistant: "AI Assistant", accent: "#db2777", logo: null, whitelabel: false };
let brand = ours;
let latest = 0;
const listeners = new Set<() => void>();

async function fetchBrand(path: string): Promise<Brand | null> {
  try {
    const res = await fetch(path, { credentials: "include" });
    if (!res.ok) return null;
    const b = (await res.json()) as { whitelabel: boolean; brand: Omit<Brand, "whitelabel"> };
    return { ...b.brand, whitelabel: b.whitelabel };
  } catch {
    return null; // offline or the API is down: ours
  }
}

export async function loadBrand(orgId: string | null): Promise<void> {
  if (!modules.partners) return apply();
  const run = ++latest;
  const applied = orgId ? await fetchBrand(`/api/v1/organizations/${orgId}/brand/applied`) : null;
  if (run !== latest) return; // the Organization changed while this was on its way
  brand = applied ?? ours;
  apply();
}

/** The theme tokens that carry the brand colour; `.dark` and `:root` set our own, which these override. */
const accentTokens = (accent: string): Record<string, string> => ({
  "--accent": accent,
  "--accent-soft": `color-mix(in srgb, ${accent} 14%, var(--surface))`,
  "--ring": accent,
  "--glow": `color-mix(in srgb, ${accent} 10%, transparent)`,
  "--sheen-a": accent,
  "--sheen-b": `color-mix(in srgb, ${accent} 70%, white)`,
  "--sheen-c": `color-mix(in srgb, ${accent} 40%, white)`,
});

function apply() {
  document.title = brand.name;
  const root = document.documentElement.style;
  for (const [token, value] of Object.entries(accentTokens(brand.accent))) {
    // Cleared for ours: an Organization switch can go from a Partner's brand back to ours.
    if (brand.whitelabel) root.setProperty(token, value);
    else root.removeProperty(token);
  }
  listeners.forEach((l) => l());
}

export const useBrand = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => void listeners.delete(l)),
    () => brand,
    () => brand,
  );
export const brandOf = () => brand;

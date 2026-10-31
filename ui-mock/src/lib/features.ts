// Which features this Organization has on. Every page and control asks
// `isOn(id)`, which also checks the feature's module and what it needs, so
// turning off a module or a dependency turns off everything under it.

import { useSyncExternalStore } from "react";
import { featureOf, features, type FeatureId } from "../data/features";

type Flags = Partial<Record<FeatureId, boolean>>;
const KEY = "gw-features";
let flags: Flags = (() => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; } })();
const listeners = new Set<() => void>();
const set = (next: Flags) => { flags = next; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {} listeners.forEach((l) => l()); };

export const useFeatures = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => flags, () => flags);
export const setFeature = (id: FeatureId, on: boolean) => set({ ...flags, [id]: on });
export const chosen = (id: FeatureId, f: Flags = flags) => f[id] !== false;

/** Whether it works, and if not, why: its own switch, its module, or a missing dependency. */
export function statusOf(id: FeatureId, f: Flags = flags): { on: boolean; why?: string } {
  const feat = featureOf(id);
  if (!chosen(id, f)) return { on: false, why: "Turned off" };
  if (feat.module && !statusOf(feat.module, f).on) return { on: false, why: `${featureOf(feat.module).label} is off` };
  if (feat.needsAny && !feat.needsAny.some((n) => statusOf(n, f).on)) return { on: false, why: `Needs ${feat.needsAny.map((n) => featureOf(n).label).join(" or ")}` };
  return { on: true };
}
export const isOn = (id: FeatureId, f: Flags = flags) => statusOf(id, f).on;
export const useOn = (id: FeatureId) => isOn(id, useFeatures());

/** What else stops working if this one is turned off. */
export const knockOn = (id: FeatureId) => features.filter((x) => x.id !== id && isOn(x.id) && !isOn(x.id, { ...flags, [id]: false }));

/** The feature that owns a page, from its path and query. The most specific link wins. */
export function featureForPage(pathname: string, search = ""): FeatureId | null {
  const cur = new URLSearchParams(search);
  let best: { id: FeatureId; score: number } | null = null;
  for (const f of features) for (const link of f.links ?? []) {
    const [path, q = ""] = link.split("?");
    const params = [...new URLSearchParams(q)];
    if (!(pathname === path || pathname.startsWith(`${path}/`)) || !params.every(([k, v]) => cur.get(k) === v)) continue;
    const score = path.length * 10 + params.length;
    if (!best || score > best.score) best = { id: f.id, score };
  }
  return best?.id ?? null;
}
export const pageOn = (to: string, f: Flags = flags) => { const [p, q] = to.split("?"); const id = featureForPage(p, q ? `?${q}` : ""); return !id || isOn(id, f); };
export const settingsOwner = (section: string) => features.find((x) => x.settings?.includes(section))?.id ?? null;

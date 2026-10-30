// Saved prospect searches and direct audits. Every search is kept automatically
// so you can go back to it without paying for it again; pin the ones you use
// often. Mock: localStorage. Real build: a saved_searches table holding the
// spec plus the raw results, so reopening reads from the database, not the API.

import { useSyncExternalStore } from "react";
import { defaultSpec, specToQuery } from "../data/prospects";

export type Saved = {
  id: string;
  kind: "search" | "audit";
  query: string; // "?kw=…&city=…" (search) or "/prospects/:id?…" path (audit)
  title: string;
  where: string;
  noSite: boolean;
  found: number;
  hot: number;
  savedAt: number;
  refreshedAt: number;
  pinned: boolean;
};

const KEY = "gw-saved-prospects";
const hr = 3_600_000;
const seed: Saved[] = [
  { id: "s_seed1", kind: "search", query: specToQuery(defaultSpec), title: "plumber", where: "Austin, TX · 5 mi", noSite: false, found: 20, hot: 3, savedAt: Date.now() - 50 * hr, refreshedAt: Date.now() - 2 * hr, pinned: true },
  { id: "s_seed2", kind: "search", query: specToQuery({ ...defaultSpec, q: "emergency dentist" }), title: "emergency dentist", where: "Austin, TX · 5 mi", noSite: false, found: 20, hot: 2, savedAt: Date.now() - 80 * hr, refreshedAt: Date.now() - 80 * hr, pinned: false },
];

function load(): Saved[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return seed;
}

let items: Saved[] = load();
const listeners = new Set<() => void>();
const set = (next: Saved[]) => {
  items = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  listeners.forEach((l) => l());
};

export function useSaved() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => items, () => items);
}

/** Add or refresh an entry, matched on its query so the same search is never listed twice. */
export function recordSaved(entry: Omit<Saved, "id" | "savedAt" | "refreshedAt" | "pinned">) {
  const now = Date.now();
  const hit = items.find((x) => x.query === entry.query);
  set(hit
    ? items.map((x) => (x === hit ? { ...x, ...entry, refreshedAt: now } : x))
    : [{ ...entry, id: `s_${now}`, savedAt: now, refreshedAt: now, pinned: false }, ...items]);
}

export const togglePin = (id: string) => set(items.map((x) => (x.id === id ? { ...x, pinned: !x.pinned } : x)));
export const removeSaved = (id: string) => set(items.filter((x) => x.id !== id));
export const findSaved = (list: Saved[], query: string) => list.find((x) => x.query === query);
export const sortSaved = (list: Saved[]) => [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.refreshedAt - a.refreshedAt);

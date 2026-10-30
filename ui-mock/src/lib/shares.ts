// Shareable audit links (#/a/:token) and their view tracking.
// Mock: the token encodes the audit path, so a link opens in any browser,
// while views are recorded in this browser's localStorage. Real build: a
// short random token in a shares table, views logged server-side (time,
// device, sections seen), with an email/Slack ping on first view.

import { useSyncExternalStore } from "react";

export type View = { at: number; device: "Desktop" | "iPhone" | "Android"; seconds: number; sections: string[] };
export type Share = {
  token: string;
  path: string; // "/prospects/:id?…"
  name: string;
  createdAt: number;
  enabled: boolean;
  views: View[];
};

const KEY = "gw-audit-shares";
const load = (): Share[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } };
let items: Share[] = load();
const listeners = new Set<() => void>();
const set = (next: Share[]) => {
  items = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  listeners.forEach((l) => l());
};

export const useShares = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => items, () => items);

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export function pathFromToken(token: string) {
  try { return decodeURIComponent(escape(atob(token.replace(/-/g, "+").replace(/_/g, "/")))); } catch { return null; }
}

export const shareFor = (list: Share[], path: string) => list.find((s) => s.path === path);
export const shareUrl = (token: string) => `${location.origin}${location.pathname}#/a/${token}`;

/** Get the link for an audit, creating it on first use. */
export function ensureShare(path: string, name: string) {
  const hit = shareFor(items, path);
  if (hit) return hit;
  const s: Share = { token: b64(path), path, name, createdAt: Date.now(), enabled: true, views: [] };
  set([s, ...items]);
  return s;
}

export const setShareEnabled = (token: string, enabled: boolean) => set(items.map((s) => (s.token === token ? { ...s, enabled } : s)));

export function recordView(token: string, view: View) {
  const s = items.find((x) => x.token === token);
  if (!s) return; // opened in a browser that never created it: nothing to attach the view to
  set(items.map((x) => (x.token === token ? { ...x, views: [...x.views, view] } : x)));
}

export const updateLastView = (token: string, patch: Partial<View>) =>
  set(items.map((x) => (x.token === token && x.views.length ? { ...x, views: [...x.views.slice(0, -1), { ...x.views[x.views.length - 1], ...patch }] } : x)));

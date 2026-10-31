// Whitelabel: a Partner's brand in place of ours, everywhere its Clients look
// (the app, reports, shared audits, emails, the assistant). With it on, nothing
// says OpenMarko or Marko; the assistant is "AI Assistant" unless renamed.
//
// The brand belongs to the session, not the Organization: whoever signs in on
// the Partner's domain (or its {slug}.openmarko.com fallback), or is a Member of
// one of its Clients on openmarko.com, sees the Partner's brand on every
// Organization they open. Real build: a whitelabel row per Partner, resolved
// from the request host before the first byte, so the title and favicon never
// flash ours. Mock: this browser's localStorage, applied before the first render.

import { useSyncExternalStore } from "react";
import { fallbackHost, partner } from "../data/partner";

export const DEFAULT_ASSISTANT = "AI Assistant";
const OURS = { name: "OpenMarko", assistant: "Marko", host: "openmarko.com", dnsZone: "openmarko.email", accent: "#db2777" };
// Records a Client adds at their DNS host point here, so they don't name us either.
// Real build: a neutral domain we own and run DKIM/bounces on.
const NEUTRAL_ZONE = "mailedge.net";

export type DomainStatus = "none" | "dns" | "live";
export type Whitelabel = {
  on: boolean;
  /** What the app is called. Blank → the Partner's name. */
  name: string;
  /** What the assistant is called. Blank → AI Assistant. */
  assistant: string;
  /** Wide logo for the sidebar, sign-in, reports and audits. Data URL. */
  logo: string | null;
  /** Square mark for the favicon, small badges and the report footer. Data URL. */
  icon: string | null;
  accent: string;
  domain: { host: string; status: DomainStatus };
  /** Where invites, digests and report emails come from. */
  email: { sender: string; address: string; verified: boolean };
  /** Help links and "contact support" go here instead of to us. */
  support: string;
};

const KEY = "gw-whitelabel";
const initial: Whitelabel = {
  on: true, name: "", assistant: "", logo: null, icon: null, accent: "#2563eb",
  domain: { host: "", status: "none" },
  email: { sender: partner?.name ?? "", address: "", verified: false },
  support: "",
};
let state: Whitelabel = (() => { try { return { ...initial, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return initial; } })();
const listeners = new Set<() => void>();

export const useWhitelabel = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => state, () => state);
export function setWhitelabel(patch: Partial<Whitelabel>) {
  state = { ...state, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  applyBrand();
  listeners.forEach((l) => l());
}

/** Whether the Partner's brand replaces ours in this session. */
export const whitelabeled = () => !!partner && state.on;
export const product = () => (whitelabeled() ? state.name.trim() || partner!.name : OURS.name);
export const assistant = () => (whitelabeled() ? state.assistant.trim() || DEFAULT_ASSISTANT : OURS.assistant);
/** Who's behind the product, for "Prepared by" lines. */
export const maker = () => (whitelabeled() ? partner!.name : OURS.name);
/** Where the app lives: the custom domain once it's live, else the fallback. */
export const appHost = () => (!whitelabeled() ? OURS.host : state.domain.status === "live" ? state.domain.host : fallbackHost(partner!));
export const dnsZone = () => (whitelabeled() ? NEUTRAL_ZONE : OURS.dnsZone);
/** Two-letter mark for places that show a provider badge (the managed email and texting options). */
export const productMark = () => (whitelabeled() ? product().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "OM");
export const brandLogo = () => (whitelabeled() ? state.logo : null);
export const brandIcon = () => (whitelabeled() ? state.icon : null);
export const brandAccent = () => (whitelabeled() ? state.accent : OURS.accent);

/** Title, favicon and accent colour. Call once before the first render, and again on every change. */
export function applyBrand() {
  const root = document.documentElement.style;
  const vars = ["--accent", "--accent-soft", "--ring", "--glow", "--sheen-a", "--sheen-b", "--sheen-c"];
  if (whitelabeled()) {
    const a = state.accent;
    root.setProperty("--accent", a);
    root.setProperty("--ring", a);
    root.setProperty("--glow", `color-mix(in srgb, ${a} 10%, transparent)`);
    root.setProperty("--accent-soft", `color-mix(in oklab, ${a} 14%, var(--surface))`);
    root.setProperty("--sheen-a", `color-mix(in oklab, ${a} 85%, black)`);
    root.setProperty("--sheen-b", `color-mix(in oklab, ${a} 60%, white)`);
    root.setProperty("--sheen-c", `color-mix(in oklab, ${a} 35%, white)`);
  } else vars.forEach((v) => root.removeProperty(v));
  document.title = whitelabeled() ? product() : `${OURS.name} — Local SEO`;
  const link = document.querySelector<HTMLLinkElement>("link[rel=icon]");
  if (link) {
    // No icon uploaded: a plain tile with the first letter, never our mark.
    const letter = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${state.accent}"/><text x="16" y="22" font-family="system-ui,sans-serif" font-size="18" font-weight="600" fill="#fff" text-anchor="middle">${product().charAt(0).toUpperCase()}</text></svg>`)}`;
    link.href = !whitelabeled() ? "/favicon.svg" : state.icon ?? letter;
    link.type = link.href.startsWith("data:image/svg") || link.href.endsWith(".svg") ? "image/svg+xml" : "";
  }
}

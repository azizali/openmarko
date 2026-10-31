// Autopilot: what Marko may do on its own when it finds something to change.
// Three words keep the ideas apart across the app:
//   Autopilot  — Marko acting for you (this file). Ask first → a To-do;
//                On its own → done and logged in Activity, with Undo.
//   Schedules  — when things run: scans, syncs, reviews (lib/schedules.ts).
//   Workflows  — your own rules for contacts: when X happens, send Y (lib/crm.ts).
//
// Some sections already had their own switch (Ads: recommend vs auto, launch
// new ads; Outreach: review before sending). Those stay where they are and are
// read and written here too, so there's one setting shown in two places.
//
// Real build: an autopilot JSON column per Organization; every Marko action
// checks its level before running and writes an activity row either way.

import { useSyncExternalStore } from "react";
import type { FeatureId } from "../data/features";
import { setGoal, useAds } from "./ads";
import { setRules, useOutreach } from "./outreach";
import { assistant } from "./whitelabel";

export type Level = "off" | "ask" | "auto";
export const levelMeta: Record<Level, { label: string; hint: string }> = {
  off: { label: "Off", hint: `${assistant()} doesn't suggest it` },
  ask: { label: "Ask first", hint: "Suggested in To-do for you to approve" },
  auto: { label: "On its own", hint: "Done, then logged in Activity with Undo" },
};

export type ActionId =
  | "gbp_posts" | "review_replies_good" | "review_replies_bad" | "gbp_details" | "alt_text" | "schema" | "citations_fix" | "articles"
  | "social_publish"
  | "ads_safe" | "ads_launch"
  | "inbox_simple"
  | "outreach_send";
export type Action = { id: ActionId; feature: FeatureId; section: string; label: string; hint: string; risk: "low" | "medium" | "high"; levels: Level[]; start: Level };

export const actions: Action[] = [
  { id: "gbp_posts", feature: "seo", section: "Local SEO", label: `Publish Business Profile posts ${assistant()} wrote`, hint: "Weekly updates and offers on Google", risk: "low", levels: ["off", "ask", "auto"], start: "auto" },
  { id: "review_replies_good", feature: "reviews", section: "Local SEO", label: "Reply to 4–5★ reviews", hint: "Thank-you replies in your voice, never confirming they're a patient", risk: "medium", levels: ["off", "ask", "auto"], start: "ask" },
  { id: "review_replies_bad", feature: "reviews", section: "Local SEO", label: "Reply to 1–3★ reviews", hint: "Always seen by a person first", risk: "high", levels: ["off", "ask"], start: "ask" },
  { id: "gbp_details", feature: "seo", section: "Local SEO", label: "Change Business Profile categories or description", hint: "Can make Google re-verify the profile", risk: "high", levels: ["off", "ask", "auto"], start: "ask" },
  { id: "alt_text", feature: "site_health", section: "Local SEO", label: "Write image alt text on your site", hint: "", risk: "low", levels: ["off", "ask", "auto"], start: "auto" },
  { id: "schema", feature: "site_health", section: "Local SEO", label: "Add or update structured data", hint: "Business details search engines read", risk: "medium", levels: ["off", "ask", "auto"], start: "ask" },
  { id: "citations_fix", feature: "citations", section: "Local SEO", label: "Correct directory listings", hint: "Fix a wrong name, address, phone or hours", risk: "medium", levels: ["off", "ask", "auto"], start: "ask" },
  { id: "articles", feature: "content", section: "Local SEO", label: "Publish articles to your site", hint: "", risk: "medium", levels: ["off", "ask", "auto"], start: "ask" },
  { id: "social_publish", feature: "social_posts", section: "Social media", label: "Fill empty calendar slots and publish", hint: `Posts ${assistant()} writes from your swipe file and trends`, risk: "medium", levels: ["off", "ask", "auto"], start: "ask" },
  { id: "ads_safe", feature: "ads", section: "Ads", label: "Apply safe changes after each ads review", hint: "Pause losing ads, cut over-target budgets, block wasted searches; within your monthly cap", risk: "medium", levels: ["ask", "auto"], start: "ask" },
  { id: "ads_launch", feature: "ad_studio", section: "Ads", label: "Launch new ads from approved creatives", hint: "Starts them on a small test budget", risk: "high", levels: ["ask", "auto"], start: "ask" },
  { id: "inbox_simple", feature: "inbox", section: "Contacts & messaging", label: "Answer simple questions in the Inbox", hint: "Hours, insurance, directions, the booking link. Anything else waits for you", risk: "medium", levels: ["off", "ask", "auto"], start: "ask" },
  { id: "outreach_send", feature: "outreach", section: "Prospecting", label: "Send prospects to your default campaign", hint: "Skips the review step when you choose Send to campaign", risk: "medium", levels: ["ask", "auto"], start: "ask" },
];

type Levels = Partial<Record<ActionId, Level>>;
const KEY = "gw-autopilot";
let levels: Levels = (() => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; } })();
const listeners = new Set<() => void>();
const save = (next: Levels) => { levels = next; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {} listeners.forEach((l) => l()); };

/** Every action's level, including the ones whose switch lives in Ads and Outreach. */
export function useAutopilot(): Record<ActionId, Level> {
  const own = useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => levels, () => levels);
  const ads = useAds();
  const out = useOutreach();
  const all = Object.fromEntries(actions.map((a) => [a.id, own[a.id] ?? a.start])) as Record<ActionId, Level>;
  return { ...all, ads_safe: ads.goal.mode === "auto" ? "auto" : "ask", ads_launch: ads.goal.launch ? "auto" : "ask", outreach_send: out.rules.review ? "ask" : "auto" };
}

export function setLevel(id: ActionId, level: Level) {
  if (id === "ads_safe") return setGoal({ mode: level === "auto" ? "auto" : "recommend" });
  if (id === "ads_launch") return setGoal({ launch: level === "auto" });
  if (id === "outreach_send") return setRules({ review: level !== "auto" });
  save({ ...levels, [id]: level });
}

export type Preset = "careful" | "balanced" | "handsoff";
/** Presets: everything asks; low risk on its own; everything allowed on its own. */
export function presetLevel(a: Action, p: Preset): Level {
  const want: Level = p === "careful" ? "ask" : p === "handsoff" || a.risk === "low" ? "auto" : "ask";
  return a.levels.includes(want) ? want : a.levels.includes("ask") ? "ask" : a.levels[0];
}
export const applyPreset = (p: Preset) => actions.forEach((a) => setLevel(a.id, presetLevel(a, p)));

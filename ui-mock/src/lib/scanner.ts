// The social scanner's settings (what to scan, for what, how often) and what
// the user did with each opportunity. Module store so the Social scanner,
// To-do and Marko agree.

import { useSyncExternalStore } from "react";
import { opportunities, platformOf, type PlatformId } from "../data/scanner";
import { trends, type TrendSourceId } from "../data/social";

export type Frequency = "hourly" | "6h" | "daily" | "weekly";
export const frequencyLabels: Record<Frequency, string> = { hourly: "every hour", "6h": "every 6 hours", daily: "every morning", weekly: "every Monday" };

export type ScanSource = { platform: PlatformId; enabled: boolean; connected: boolean; places: string[] };
export type TermGroup = "Services" | "Your name" | "Competitors" | "Other";
export type Config = {
  sources: ScanSource[];
  terms: Record<TermGroup, string[]>;
  frequency: Frequency;
  maxAge: "24h" | "3d" | "7d";
  alertOnMentions: boolean;
  trending: {
    sources: Record<TrendSourceId, boolean>;
    topics: string[];
    area: string;
    reach: "city" | "state" | "country";
    avoid: string[];
    minFit: number;
    frequency: Frequency;
  };
};

export type OppStatus = "open" | "replied" | "dismissed";
type State = { config: Config; status: Record<string, OppStatus>; drafts: Record<string, string>; scannedAt: number; scanning: boolean };

const initial: Config = {
  sources: [
    { platform: "reddit", enabled: true, connected: true, places: ["r/Austin", "r/askdentists", "r/SouthAustin"] },
    { platform: "fbgroups", enabled: true, connected: true, places: ["South Austin Parents", "Austin Moms Network", "Travis Heights Neighbors"] },
    { platform: "nextdoor", enabled: true, connected: true, places: ["Travis Heights", "Bouldin Creek", "Zilker", "Mueller"] },
    { platform: "x", enabled: true, connected: true, places: ["Within 10 miles of Austin"] },
    { platform: "quora", enabled: true, connected: true, places: ["Dentistry", "Orthodontics", "Oral health"] },
  ],
  terms: {
    "Services": ["dentist austin", "emergency dentist", "invisalign", "kids dentist 78704", "teeth whitening"],
    "Your name": ["Maple & Main Dental", "Dr. Patel dentist"],
    "Competitors": ["Bright Smile Austin", "Congress Ave Dental"],
    "Other": ["dentist that doesn't upsell"],
  },
  frequency: "6h",
  maxAge: "3d",
  alertOnMentions: true,
  trending: {
    sources: { tiktok: true, reels: true, gtrends: true, reddit: true, x: false, news: true },
    topics: ["dentistry", "oral health", "Austin", "small business"],
    area: "Austin, TX",
    reach: "city",
    avoid: ["politics", "tragedy or crime", "celebrity gossip", "health claims we can't back up"],
    minFit: 60,
    frequency: "daily",
  },
};

let state: State = { config: initial, status: {}, drafts: {}, scannedAt: Date.now() - 2 * 3_600_000, scanning: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
export const useScanner = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => state, () => state);

export const updateConfig = (patch: Partial<Config>) => set({ config: { ...state.config, ...patch } });
export const updateTrending = (patch: Partial<Config["trending"]>) => set({ config: { ...state.config, trending: { ...state.config.trending, ...patch } } });
export const updateSource = (platform: PlatformId, patch: Partial<ScanSource>) =>
  updateConfig({ sources: state.config.sources.map((s) => (s.platform === platform ? { ...s, ...patch } : s)) });
export const addSource = (platform: PlatformId) =>
  updateConfig({ sources: [...state.config.sources, { platform, enabled: true, connected: !platformOf(platform).login, places: [] }] });
export const removeSource = (platform: PlatformId) => updateConfig({ sources: state.config.sources.filter((s) => s.platform !== platform) });

/** Sources the scanner actually reads: added, on, and connected when the platform needs a login. */
export const activeSources = (c = state.config) => c.sources.filter((s) => s.enabled && s.connected).map((s) => s.platform);

export const statusOf = (id: string): OppStatus => state.status[id] ?? "open";
export const draftOf = (id: string) => state.drafts[id] ?? opportunities.find((o) => o.id === id)!.draft;
/** Open conversations from active sources, best fit first. */
export const openOpportunities = () => {
  const on = activeSources();
  return opportunities.filter((o) => statusOf(o.id) === "open" && on.includes(o.platform)).sort((a, b) => b.fit - a.fit);
};
/** Trends seen on at least one source that's on, at or above the fit bar. */
export const visibleTrends = (c = state.config) =>
  trends.filter((t) => t.fit >= c.trending.minFit && t.from.some((s) => c.trending.sources[s])).sort((a, b) => b.fit - a.fit);

export const setOppStatus = (id: string, s: OppStatus) => set({ status: { ...state.status, [id]: s } });
export const editDraft = (id: string, text: string) => set({ drafts: { ...state.drafts, [id]: text } });

export function scanNow() {
  set({ scanning: true });
  setTimeout(() => set({ scanning: false, scannedAt: Date.now() }), 1400);
}

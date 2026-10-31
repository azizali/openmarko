// Schedules: everything that runs on its own clock, in one place. Data
// refreshes (scans, syncs, crawls), Marko's reviews (ads), and the daily check
// that starts date- and list-based workflows. What Marko may *do* with what a
// run finds is Autopilot (lib/autopilot.ts); the log of what ran is Activity.
//
// The ads review already had its cadence on the Ads page; it's read and
// written from here too. Report emails keep their schedule in Reports.
//
// Real build: one cron row per Organization and job; workers enqueue runs.

import { useSyncExternalStore } from "react";
import type { FeatureId } from "../data/features";
import type { RunKind } from "./runs";
import { setGoal, useAds, type Cadence } from "./ads";

export type Every = "hourly" | "6h" | "daily" | "3d" | "weekly" | "monthly" | "paused";
export const everyMeta: Record<Every, { label: string; hours: number }> = {
  hourly: { label: "Every hour", hours: 1 },
  "6h": { label: "Every 6 hours", hours: 6 },
  daily: { label: "Daily", hours: 24 },
  "3d": { label: "Every 3 days", hours: 72 },
  weekly: { label: "Weekly", hours: 168 },
  monthly: { label: "Monthly", hours: 720 },
  paused: { label: "Paused", hours: 0 },
};

export type JobId = "profile" | "rank" | "competitors" | "ai" | "citations" | "links" | "audit" | "social_scan" | "ad_watch" | "ads_review" | "workflow_checks";
export type Job = { id: JobId; feature: FeatureId; section: string; label: string; what: string; options: Every[]; start: Every; at?: string; run?: RunKind; cost?: string };

export const jobs: Job[] = [
  { id: "profile", feature: "seo", section: "Local SEO", label: "Business Profile sync", what: "New reviews, posts and insights from Google", options: ["hourly", "6h", "daily"], start: "6h", run: "profile" },
  { id: "rank", feature: "rankings", section: "Local SEO", label: "Rank scan", what: "Every keyword across the map grid", options: ["daily", "3d", "weekly", "paused"], start: "daily", at: "06:00", run: "rank", cost: "~$0.47 a scan" },
  { id: "competitors", feature: "rankings", section: "Local SEO", label: "Competitor refresh", what: "Competitors' profiles, reviews and links", options: ["weekly", "monthly", "paused"], start: "weekly", at: "Sundays", run: "competitors" },
  { id: "ai", feature: "ai_answers", section: "Local SEO", label: "AI answer check", what: "Asks ChatGPT, Gemini and others who they recommend", options: ["weekly", "monthly", "paused"], start: "weekly", at: "Mondays", run: "ai", cost: "~$0.86 a check" },
  { id: "citations", feature: "citations", section: "Local SEO", label: "Citation check", what: "Your listings on 18 directories", options: ["weekly", "monthly", "paused"], start: "weekly", at: "Wednesdays", run: "citations" },
  { id: "links", feature: "citations", section: "Local SEO", label: "Backlink refresh", what: "Links to you and to competitors", options: ["weekly", "monthly", "paused"], start: "weekly", at: "Thursdays", run: "links" },
  { id: "audit", feature: "site_health", section: "Local SEO", label: "Site crawl", what: "Every page on your site, mobile and desktop", options: ["daily", "weekly", "monthly", "paused"], start: "weekly", at: "Mondays", run: "audit" },
  { id: "social_scan", feature: "social_scanner", section: "Social media", label: "Social scanner", what: "Trending posts and the accounts you watch", options: ["6h", "daily", "weekly", "paused"], start: "daily", at: "07:00" },
  { id: "ad_watch", feature: "ad_research", section: "Ads", label: "Competitor ad check", what: "New ads from advertisers you watch", options: ["daily", "weekly", "paused"], start: "daily", at: "08:00" },
  { id: "ads_review", feature: "ads", section: "Ads", label: "Ads review", what: "Compares every ad to your goal and makes recommendations", options: ["daily", "3d", "weekly"], start: "daily", at: "09:00" },
  { id: "workflow_checks", feature: "workflows", section: "Contacts & messaging", label: "Workflow date & list check", what: "Starts workflows that wait for a date or a list, like a cleaning coming due or a birthday", options: ["hourly", "daily"], start: "daily", at: "07:00" },
];

type Saved = Partial<Record<JobId, Every>>;
const KEY = "gw-schedules";
let saved: Saved = (() => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; } })();
const listeners = new Set<() => void>();
const save = (next: Saved) => { saved = next; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {} listeners.forEach((l) => l()); };
const adsEvery: Record<Cadence, Every> = { daily: "daily", "3d": "3d", weekly: "weekly" };

export function useSchedules(): Record<JobId, Every> {
  const own = useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => saved, () => saved);
  const ads = useAds();
  const all = Object.fromEntries(jobs.map((j) => [j.id, own[j.id] ?? j.start])) as Record<JobId, Every>;
  return { ...all, ads_review: adsEvery[ads.goal.cadence] };
}
export function setEvery(id: JobId, every: Every) {
  if (id === "ads_review") return setGoal({ cadence: every as Cadence });
  save({ ...saved, [id]: every });
}

/** "Daily at 06:00", "Weekly, Mondays", "Paused". A time goes with daily runs, a weekday with weekly ones. */
export function describeEvery(j: Job, every: Every) {
  if (every === "paused") return "Paused";
  const base = everyMeta[every].label;
  const time = j.at?.includes(":");
  if (j.at && every === "weekly" && !time) return `${base}, ${j.at}`;
  if (j.at && (every === "daily" || every === "3d") && time) return `${base} at ${j.at}`;
  return base;
}
export const scheduleForRun = (kind: RunKind) => { const j = jobs.find((x) => x.run === kind); return j ? describeEvery(j, saved[j.id] ?? j.start) : "On demand"; };

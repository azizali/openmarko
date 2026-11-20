// Every data refresh is a Run: rank scans, site crawls, profile syncs,
// competitor refreshes and prospect searches. Pages read "last updated" and
// "in progress" from this store, and the Runs page shows the full log. When
// each kind runs is set in Settings → Schedules (lib/schedules.ts).
// Real build: rows in a runs table, progress from DataForSEO task postbacks.

import { useSyncExternalStore } from "react";

export type RunKind = "rank" | "audit" | "profile" | "competitors" | "ai" | "citations" | "links" | "prospect";
export type RunStatus = "running" | "done" | "failed";
export type Run = {
  id: string;
  kind: RunKind;
  label: string;
  trigger: "Scheduled" | "Manual";
  status: RunStatus;
  started: number; // epoch ms
  expectedSec: number;
  durationSec?: number;
  progress: number; // 0–1
  scope: string;
  cost: number;
  note?: string;
};

export const runKinds: Record<RunKind, { label: string; noun: string; button: string }> = {
  rank: { label: "Rank scan", noun: "rankings", button: "Run scan" },
  audit: { label: "Site crawl", noun: "site audit", button: "Re-crawl site" },
  profile: { label: "Profile sync", noun: "Business Profile", button: "Sync profile" },
  competitors: { label: "Competitor refresh", noun: "competitor data", button: "Refresh competitors" },
  ai: { label: "AI answer check", noun: "AI answers", button: "Check AI answers" },
  citations: { label: "Citation check", noun: "citations", button: "Re-check citations" },
  links: { label: "Backlink refresh", noun: "backlinks", button: "Refresh backlinks" },
  prospect: { label: "Prospect search", noun: "prospect data", button: "Search" },
};

const NOW = Date.now();
const min = 60_000;
const ago = (m: number) => NOW - m * min;
let seq = 0;
const seed = (r: Omit<Run, "id" | "progress" | "expectedSec"> & { expectedSec?: number; progress?: number }): Run => ({
  id: `run_${++seq}`,
  progress: r.status === "running" ? 0 : 1,
  expectedSec: r.durationSec ?? 60,
  ...r,
});

let runs: Run[] = [
  seed({ kind: "profile", label: "Profile sync", trigger: "Scheduled", status: "running", started: NOW - 50_000, expectedSec: 75, scope: "Reviews, posts, insights", cost: 0.01 }),
  seed({ kind: "prospect", label: "plumber · Austin, TX", trigger: "Manual", status: "done", started: ago(128), durationSec: 34, scope: "14 businesses · 7×7 grid each", cost: 0.62 }),
  seed({ kind: "rank", label: "Rank scan", trigger: "Scheduled", status: "done", started: ago(206), durationSec: 128, scope: "16 keywords · 7×7 grid", cost: 0.47 }),
  seed({ kind: "audit", label: "Site crawl", trigger: "Scheduled", status: "done", started: ago(208), durationSec: 134, scope: "46 pages · mobile + desktop", cost: 0.09 }),
  seed({ kind: "profile", label: "Profile sync", trigger: "Scheduled", status: "done", started: ago(372), durationSec: 41, scope: "Reviews, posts, insights", cost: 0.01 }),
  seed({ kind: "ai", label: "AI answer check", trigger: "Scheduled", status: "done", started: ago(60 * 22), durationSec: 212, scope: "8 questions × 6 engines × 3 asks", cost: 0.86 }),
  seed({ kind: "citations", label: "Citation check", trigger: "Scheduled", status: "done", started: ago(60 * 46), durationSec: 88, scope: "18 directories · name, address, phone, hours", cost: 0.11 }),
  seed({ kind: "links", label: "Backlink refresh", trigger: "Scheduled", status: "done", started: ago(60 * 70), durationSec: 31, scope: "You + 5 competitors · link gap", cost: 0.24 }),
  seed({ kind: "competitors", label: "Competitor refresh", trigger: "Scheduled", status: "done", started: ago(60 * 26), durationSec: 96, scope: "5 competitors · profiles + backlinks", cost: 0.18 }),
  seed({ kind: "rank", label: "Rank scan", trigger: "Scheduled", status: "done", started: ago(60 * 27 + 46), durationSec: 131, scope: "16 keywords · 7×7 grid", cost: 0.47 }),
  seed({ kind: "audit", label: "Site crawl", trigger: "Manual", status: "failed", started: ago(60 * 30), durationSec: 302, scope: "46 pages", cost: 0.04, note: "Timed out on /blog (server returned 503). Retried automatically 15 min later." }),
  seed({ kind: "rank", label: "Rank scan", trigger: "Scheduled", status: "done", started: ago(60 * 51 + 46), durationSec: 126, scope: "16 keywords · 7×7 grid", cost: 0.47 }),
  seed({ kind: "rank", label: "Rank scan", trigger: "Scheduled", status: "done", started: ago(60 * 75 + 46), durationSec: 140, scope: "15 keywords · 7×7 grid", cost: 0.44 }),
  seed({ kind: "prospect", label: "emergency dentist · Austin, TX", trigger: "Manual", status: "done", started: ago(60 * 80), durationSec: 29, scope: "14 businesses · 7×7 grid each", cost: 0.62 }),
];

// ---------- Store ----------

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
let ticker: ReturnType<typeof setInterval> | null = null;

function tick() {
  const now = Date.now();
  let changed = false;
  runs = runs.map((r) => {
    if (r.status !== "running") return r;
    changed = true;
    const progress = Math.min(1, (now - r.started) / (r.expectedSec * 1000));
    return progress >= 1 ? { ...r, status: "done", progress: 1, durationSec: Math.round((now - r.started) / 1000) } : { ...r, progress };
  });
  if (!runs.some((r) => r.status === "running") && ticker) { clearInterval(ticker); ticker = null; }
  if (changed) emit();
}

function ensureTicker() {
  if (!ticker && runs.some((r) => r.status === "running")) ticker = setInterval(tick, 400);
}
ensureTicker();

const defaults: Record<RunKind, { scope: string; cost: number; sec: number }> = {
  rank: { scope: "16 keywords · 7×7 grid", cost: 0.47, sec: 25 },
  audit: { scope: "46 pages · mobile + desktop", cost: 0.09, sec: 20 },
  profile: { scope: "Reviews, posts, insights", cost: 0.01, sec: 8 },
  competitors: { scope: "5 competitors · profiles + backlinks", cost: 0.18, sec: 15 },
  ai: { scope: "8 questions × 6 engines × 3 asks", cost: 0.86, sec: 18 },
  citations: { scope: "18 directories · name, address, phone, hours", cost: 0.11, sec: 12 },
  links: { scope: "You + 5 competitors · link gap", cost: 0.24, sec: 10 },
  prospect: { scope: "14 businesses · 7×7 grid each", cost: 0.62, sec: 2.5 },
};

export function startRun(kind: RunKind, opts: { label?: string; scope?: string; cost?: number; seconds?: number } = {}) {
  const d = defaults[kind];
  const run: Run = {
    id: `run_${++seq}`, kind, label: opts.label ?? runKinds[kind].label, trigger: "Manual", status: "running",
    started: Date.now(), expectedSec: opts.seconds ?? d.sec, progress: 0, scope: opts.scope ?? d.scope, cost: opts.cost ?? d.cost,
  };
  runs = [run, ...runs];
  emit();
  ensureTicker();
  return run.id;
}

export function useRuns() {
  return useSyncExternalStore(subscribe, () => runs, () => runs);
}

export const runningOf = (rs: Run[], kind?: RunKind) => rs.filter((r) => r.status === "running" && (!kind || r.kind === kind));
export const lastDone = (rs: Run[], kind: RunKind) => rs.filter((r) => r.kind === kind && r.status === "done").sort((a, b) => b.started - a.started)[0];

export function timeAgo(ms: number) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export const stamp = (ms: number) => new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export const dur = (sec?: number) => (sec === undefined ? "—" : sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, "0")}s`);

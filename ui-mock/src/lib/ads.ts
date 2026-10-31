// The Organization's ad accounts, its goal, and the review loop: Marko reads
// results on the goal's schedule, recommends changes (pause, scale, cut, add
// negatives, refresh tired ads), and either waits for approval or applies the
// safe ones within the guardrails. Every change is logged with what happened
// after it, and can be undone.
// Mock: localStorage; "Review now" simulates the days since the last review.
// Real build: a scheduled job per Organization pulls insights from each ad
// account, runs the same rules, asks Claude to write the reasons, and writes
// changes back through the Meta / Google / TikTok APIs.

import { useSyncExternalStore } from "react";
import { adPlatforms, angles, resultKinds, seedRows, tools, type AdPlatform, type Angle, type Format, type ResultKind, type Row, type ToolId } from "../data/ads";

export type Cadence = "daily" | "3d" | "weekly";
export const cadences: Record<Cadence, { label: string; days: number }> = {
  daily: { label: "Every day", days: 1 },
  "3d": { label: "Every 3 days", days: 3 },
  weekly: { label: "Every Monday", days: 7 },
};

export type Goal = {
  result: ResultKind;
  target: number; // cost per result
  monthly: number; // never spend more than this in a month
  cadence: Cadence;
  mode: "recommend" | "auto";
  step: number; // max budget change in one go, %
  minSpend: number; // × target spent before an ad can be judged
  launch: boolean; // may launch new ads without asking
};

export type RecKind = "pause" | "scale" | "cut" | "negatives" | "refresh" | "more";
export type Rec = { id: string; kind: RecKind; rowId: string; title: string; why: string; impact: string; safe: boolean };
export type Change = { id: string; at: number; by: "you" | "marko"; kind: RecKind | "resume" | "budget" | "publish"; title: string; rowId?: string; before?: Partial<Row>; outcome?: string; undone?: boolean };

type State = {
  connected: Partial<Record<ToolId, number>>;
  goal: Goal;
  rows: Row[];
  dismissed: string[];
  log: Change[];
  lastReview: number;
  reviewing: boolean;
};

const KEY = "gw-ads";
const hr = 3_600_000, day = 24 * hr;
const now = Date.now();
const initial: State = {
  connected: { meta: now - 40 * day, google: now - 200 * day, pixel: now - 40 * day, gads_conv: now - 200 * day },
  goal: { result: "booking", target: 60, monthly: 5500, cadence: "daily", mode: "recommend", step: 20, minSpend: 2, launch: false },
  rows: seedRows,
  dismissed: [],
  log: [
    { id: "h1", at: now - 6 * day, by: "marko", kind: "pause", title: "Paused “Smile makeover” carousel", outcome: "New patients · Austin went from $81 to $68 a booking in the 6 days since." },
    { id: "h2", at: now - 9 * day, by: "you", kind: "scale", title: "Raised Emergency dentist · Search from $32 to $40 a day", outcome: "3 more bookings a week, at $36 each." },
    { id: "h3", at: now - 13 * day, by: "marko", kind: "negatives", title: "Added 14 negative keywords to Emergency dentist · Search", outcome: "About $38 a week no longer goes to job seekers and other cities." },
    { id: "h4", at: now - 20 * day, by: "you", kind: "publish", title: "Launched Invisalign consult with 2 ads", outcome: "3 consults booked at $47 each so far." },
  ],
  lastReview: now - 6 * hr,
  reviewing: false,
};
const load = (): State => {
  try { return { ...initial, ...JSON.parse(localStorage.getItem(KEY) ?? "{}"), reviewing: false }; } catch { return initial; }
};
let state: State = load();
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  listeners.forEach((l) => l());
};
let seq = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

export const useAds = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => state, () => state);
export const isConnected = (s: State, id: ToolId) => !!s.connected[id];
export const connectedPlatforms = (s: State) => (Object.keys(adPlatforms) as AdPlatform[]).filter((p) => s.connected[p]);
export const connectTool = (id: ToolId) => set({ ...state, connected: { ...state.connected, [id]: Date.now() } });
/** Disconnecting an ad account also drops what depends on it (its conversion tracking). */
export const disconnectTool = (id: ToolId) => {
  const connected = { ...state.connected };
  delete connected[id];
  tools.filter((t) => t.needs === id).forEach((t) => delete connected[t.id]);
  set({ ...state, connected });
};
export const setGoal = (patch: Partial<Goal>) => set({ ...state, goal: { ...state.goal, ...patch } });
export const resultWord = (g: Goal, n = 2) => (n === 1 ? resultKinds[g.result].one : resultKinds[g.result].many);
export const nextReview = (s: State) => s.lastReview + cadences[s.goal.cadence].days * day;

// ---------- Numbers ----------

export type Metrics = { spend: number; results: number; impressions: number; clicks: number; cpa: number; ctr: number; budget: number };
const leavesOf = (rows: Row[], id: string): Row[] => {
  const kids = rows.filter((r) => r.parentId === id);
  return kids.length ? kids.flatMap((k) => leavesOf(rows, k.id)) : rows.filter((r) => r.id === id);
};
/** Campaigns and ad sets add up their ads; paused ads still count what they spent. */
export function metricsOf(rows: Row[], id: string): Metrics {
  const ls = leavesOf(rows, id);
  const sum = (k: "spend" | "results" | "impressions" | "clicks") => ls.reduce((a, r) => a + r[k], 0);
  const spend = sum("spend"), results = sum("results"), impressions = sum("impressions"), clicks = sum("clicks");
  const row = rows.find((r) => r.id === id);
  return { spend, results, impressions, clicks, cpa: results ? spend / results : Infinity, ctr: impressions ? (clicks / impressions) * 100 : 0, budget: row?.budget ?? 0 };
}
export const budgetOwner = (rows: Row[], r: Row) => rows.find((x) => x.id === r.campaignId)!;
export const dailyBudget = (rows: Row[]) => rows.filter((r) => r.level === "campaign" && r.status === "active").reduce((a, r) => a + (r.budget ?? 0), 0);
const ctrDrop = (r: Row) => (r.ctrTrend.length > 2 ? 1 - r.ctrTrend[r.ctrTrend.length - 1] / r.ctrTrend[0] : 0);

export type Verdict = "learning" | "winning" | "on" | "losing" | "tired" | "paused";
export const verdicts: Record<Verdict, { label: string; tone: "info" | "good" | "neutral" | "bad" | "warn" }> = {
  winning: { label: "Winning", tone: "good" },
  on: { label: "On target", tone: "neutral" },
  learning: { label: "Learning", tone: "info" },
  tired: { label: "Wearing out", tone: "warn" },
  losing: { label: "Losing", tone: "bad" },
  paused: { label: "Paused", tone: "neutral" },
};
export function verdictOf(rows: Row[], r: Row, g: Goal): Verdict {
  if (r.status === "paused") return "paused";
  const m = metricsOf(rows, r.id);
  if (r.level === "ad" && (r.frequency ?? 0) >= 3.5 && ctrDrop(r) >= 0.25) return "tired";
  if (m.results < 3 && m.spend < g.minSpend * g.target) return "learning";
  if (m.cpa <= g.target * 0.8) return "winning";
  if (m.cpa <= g.target * 1.1) return "on";
  return "losing";
}

// ---------- Recommendations ----------

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
export { money };

export function recommendations(s: State): Rec[] {
  const { rows, goal: g } = s;
  const T = g.target, w = (n: number) => resultWord(g, n);
  const live = rows.filter((r) => r.status === "active" && s.connected[r.platform]);
  const out: Rec[] = [];
  const room = g.monthly / 30 - dailyBudget(rows.filter((r) => s.connected[r.platform]));

  for (const r of live.filter((x) => x.level === "ad")) {
    const m = metricsOf(rows, r.id);
    const siblings = live.filter((x) => x.level === "ad" && x.campaignId === r.campaignId && x.id !== r.id);
    if (m.spend >= g.minSpend * T && m.cpa > T * 1.5 && siblings.length) {
      out.push({ id: `pause:${r.id}`, kind: "pause", rowId: r.id, title: `Pause “${r.name}”`, safe: true,
        why: `${money(m.spend)} spent for ${m.results} ${w(m.results)}${m.results ? ` (${money(m.cpa)} each)` : ""}, against a ${money(T)} target. The other ads in this campaign do better, so its budget goes to them.`,
        impact: `About ${money(m.spend / 7)} a day moves to ads that book under target` });
    } else if (verdictOf(rows, r, g) === "tired") {
      out.push({ id: `refresh:${r.id}`, kind: "refresh", rowId: r.id, title: `“${r.name}” is wearing out`, safe: false,
        why: `People have seen it ${r.frequency?.toFixed(1)} times on average and clicks fell ${Math.round(ctrDrop(r) * 100)}% this week. It still books, so make fresh versions before pausing it.`,
        impact: "New versions of the same angle usually win back the click rate" });
    } else if (r.fromStudio && m.results >= 3 && m.cpa <= T * 0.8) {
      out.push({ id: `more:${r.id}`, kind: "more", rowId: r.id, title: `“${r.name}” won its test. Make more like it`, safe: false,
        why: `${m.results} ${w(m.results)} at ${money(m.cpa)} each, the best in its test. More hooks on the same angle find the next winner faster.`,
        impact: "Keeps the campaign fresh while the winner scales" });
    }
  }
  for (const c of live.filter((x) => x.level === "campaign" && x.budget)) {
    const m = metricsOf(rows, c.id);
    const b = c.budget!;
    if (m.results >= 5 && m.cpa <= T * 0.8) {
      const up = Math.max(1, Math.round(b * (g.step / 100)));
      if (up <= room) out.push({ id: `scale:${c.id}`, kind: "scale", rowId: c.id, title: `Raise “${c.name}” from ${money(b)} to ${money(b + up)} a day`, safe: true,
        why: `${money(m.cpa)} a ${w(1)}, ${Math.round((1 - m.cpa / T) * 100)}% under target${c.limitedBy ? `, and it missed ${c.limitedBy}% of searches because the budget ran out` : ""}. A ${g.step}% step keeps it out of learning.`,
        impact: `About ${Math.max(1, Math.round((up * 7) / m.cpa))} more ${w(2)} a week` });
    } else if (m.spend >= g.minSpend * T && m.cpa > T * 1.3) {
      const down = Math.max(1, Math.round(b * 0.3));
      out.push({ id: `cut:${c.id}`, kind: "cut", rowId: c.id, title: `Cut “${c.name}” from ${money(b)} to ${money(b - down)} a day`, safe: true,
        why: `${money(m.cpa)} a ${w(1)}, ${Math.round((m.cpa / T - 1) * 100)}% over target after ${money(m.spend)}. Keep it running smaller while a new angle is tested.`,
        impact: `Frees ${money(down)} a day for campaigns under target` });
    }
    if (c.wasteTerms?.length) {
      out.push({ id: `negatives:${c.id}`, kind: "negatives", rowId: c.id, title: `Block ${c.wasteTerms.length} search terms in “${c.name}”`, safe: true,
        why: `These searches cost money and never booked: ${c.wasteTerms.slice(0, 4).map((t) => `“${t}”`).join(", ")} and ${c.wasteTerms.length - 4} more.`,
        impact: `About ${money(c.wasteTerms.length * 4.6)} a week back` });
    }
  }
  const order: RecKind[] = ["pause", "cut", "negatives", "scale", "refresh", "more"];
  return out.filter((r) => !s.dismissed.includes(r.id)).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

const patchRow = (rows: Row[], id: string, patch: Partial<Row>) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r));

function applyTo(s: State, rec: Rec, by: Change["by"]): State {
  const r = s.rows.find((x) => x.id === rec.rowId);
  if (!r || rec.kind === "refresh" || rec.kind === "more") return s;
  let patch: Partial<Row> = {}, before: Partial<Row> = {};
  if (rec.kind === "pause") { patch = { status: "paused" }; before = { status: r.status }; }
  if (rec.kind === "scale") { const up = Math.max(1, Math.round(r.budget! * (s.goal.step / 100))); patch = { budget: r.budget! + up, limitedBy: undefined }; before = { budget: r.budget, limitedBy: r.limitedBy }; }
  if (rec.kind === "cut") { const down = Math.max(1, Math.round(r.budget! * 0.3)); patch = { budget: r.budget! - down }; before = { budget: r.budget }; }
  if (rec.kind === "negatives") { patch = { wasteTerms: [] }; before = { wasteTerms: r.wasteTerms }; }
  const change: Change = { id: uid("ch"), at: Date.now(), by, kind: rec.kind, title: rec.title.replace(/^Pause/, "Paused").replace(/^Raise/, "Raised").replace(/^Cut/, "Cut").replace(/^Block/, "Blocked"), rowId: r.id, before };
  return { ...s, rows: patchRow(s.rows, r.id, patch), log: [change, ...s.log] };
}

export const applyRec = (rec: Rec) => set(applyTo(state, rec, "you"));
export const applyAll = (recs: Rec[]) => set(recs.filter((r) => r.safe).reduce((s, r) => applyTo(s, r, "you"), state));
export const dismissRec = (id: string) => set({ ...state, dismissed: [...state.dismissed, id] });

export function undoChange(id: string) {
  const c = state.log.find((x) => x.id === id);
  if (!c?.rowId || !c.before || c.undone) return;
  set({ ...state, rows: patchRow(state.rows, c.rowId, c.before), log: state.log.map((x) => (x.id === id ? { ...x, undone: true, outcome: "Undone." } : x)) });
}

/** Changes made by hand from the table. */
export function setRowStatus(ids: string[], status: Row["status"]) {
  const rows = state.rows.filter((r) => ids.includes(r.id) && r.status !== status);
  if (!rows.length) return;
  const log: Change[] = rows.map((r) => ({ id: uid("ch"), at: Date.now(), by: "you", kind: status === "paused" ? "pause" : "resume", title: `${status === "paused" ? "Paused" : "Turned on"} “${r.name}”`, rowId: r.id, before: { status: r.status } }));
  set({ ...state, rows: state.rows.map((r) => (ids.includes(r.id) ? { ...r, status } : r)), log: [...log, ...state.log] });
}
export function setBudget(id: string, budget: number) {
  const r = state.rows.find((x) => x.id === id);
  if (!r || r.budget === budget) return;
  const c: Change = { id: uid("ch"), at: Date.now(), by: "you", kind: "budget", title: `Changed “${r.name}” from ${money(r.budget ?? 0)} to ${money(budget)} a day`, rowId: id, before: { budget: r.budget } };
  set({ ...state, rows: patchRow(state.rows, id, { budget }), log: [c, ...state.log] });
}

// ---------- Review ----------

/** Pretend the days since the last review happened, then recommend (or apply) changes. */
export function runReview(onDone?: (applied: number, open: number) => void) {
  if (state.reviewing) return;
  set({ ...state, reviewing: true });
  setTimeout(() => {
    const days = cadences[state.goal.cadence].days;
    const T = state.goal.target;
    const rows = state.rows.map((r) => {
      if (r.level !== "ad" || r.status !== "active" || !r.fromStudio) return r;
      const camp = budgetOwner(state.rows, r);
      const ads = state.rows.filter((x) => x.level === "ad" && x.campaignId === camp.id && x.status === "active").length;
      const spend = ((camp.budget ?? 0) / Math.max(1, ads)) * days;
      const q = r.quality ?? 0.5;
      const results = Math.floor((spend * (q * 1.7 - 0.25)) / T + Math.random() * 0.8);
      const impressions = Math.round(spend * 95), ctr = 0.6 + q * 1.4;
      return { ...r, spend: r.spend + spend, results: r.results + Math.max(0, results), impressions: r.impressions + impressions, clicks: r.clicks + Math.round((impressions * ctr) / 100), ctrTrend: [...r.ctrTrend, +ctr.toFixed(2)].slice(-7), startedDaysAgo: r.startedDaysAgo + days };
    });
    const log = state.log.map((c) => (c.outcome || c.undone ? c : { ...c, outcome: outcomeFor(c) }));
    let next: State = { ...state, rows, log, lastReview: Date.now(), reviewing: false };
    const recs = recommendations(next);
    let applied = 0;
    if (next.goal.mode === "auto") {
      for (const r of recs.filter((x) => x.safe)) { next = applyTo(next, r, "marko"); applied++; }
    }
    set(next);
    onDone?.(applied, recommendations(next).length);
  }, 1600);
}

function outcomeFor(c: Change) {
  if (c.kind === "pause") return "Its budget went to the other ads; cost per result on the campaign is down since.";
  if (c.kind === "scale") return "Spent the extra budget and stayed under target.";
  if (c.kind === "cut") return "Spending less on it; cost per result is unchanged so far.";
  if (c.kind === "negatives") return "Those searches no longer trigger the ad.";
  if (c.kind === "publish") return "In learning. Marko judges each ad once it has spent enough.";
  return "Done.";
}

// ---------- Publishing from the studio ----------

export type PublishAd = { id: string; angle: Angle; format: Format; headline: string; text: string; hue: number; score: number };
export type PublishSpec = { platform: AdPlatform; name: string; into: string | null; byAngle: boolean; budget: number; places: string[]; paused: boolean; batchId: string };

/** Creates the campaign (or new ad sets in an existing one) and returns its id. */
export function publishAds(spec: PublishSpec, ads: PublishAd[]) {
  const cid = spec.into ?? uid("c_");
  const groups = spec.byAngle ? [...new Set(ads.map((a) => a.angle))] : [null];
  const status: Row["status"] = spec.paused ? "paused" : "active";
  const blank = { spend: 0, results: 0, impressions: 0, clicks: 0, ctrTrend: [], startedDaysAgo: 0, platform: spec.platform, campaignId: cid, status };
  const out: Row[] = [];
  if (!spec.into) out.push({ ...blank, id: cid, level: "campaign", name: spec.name, budget: spec.budget * groups.length });
  for (const g of groups) {
    const sid = uid("s_");
    const label = g ? angles[g].label : "All creatives";
    out.push({ ...blank, id: sid, level: "adset", parentId: cid, name: `${label} · ${spec.places.join(" + ")}` });
    for (const a of ads.filter((x) => !g || x.angle === g)) {
      out.push({ ...blank, id: uid("a_"), level: "ad", parentId: sid, name: a.headline, fromStudio: spec.batchId, quality: a.score / 100, copy: { angle: a.angle, format: a.format, headline: a.headline, text: a.text, hue: a.hue } });
    }
  }
  const rows = spec.into ? state.rows.map((r) => (r.id === spec.into ? { ...r, budget: (r.budget ?? 0) + spec.budget * groups.length } : r)) : state.rows;
  const where = spec.into ? `into “${state.rows.find((r) => r.id === spec.into)?.name}”` : `as “${spec.name}”`;
  const c: Change = { id: uid("ch"), at: Date.now(), by: "you", kind: "publish", title: `Published ${ads.length} ads to ${adPlatforms[spec.platform].name} ${where}${spec.paused ? ", paused" : ""}` };
  set({ ...state, rows: [...rows, ...out], log: [c, ...state.log] });
  return cid;
}

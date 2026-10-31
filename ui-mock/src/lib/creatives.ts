// The ad swipe file and the creative studio. Ads saved from research (or your
// own winners) are references; a brief multiplies angles × hooks × formats
// into a batch of creatives, each checked against ad rules and the brand's
// rules, scored, and approved or rejected before publishing.
// Mock: localStorage, copy from data/ads.ts copyBank. Real build: Claude
// writes each variation from the brief, the references and the brand voice;
// the renderer (Creatomate / Bannerbear) draws every size from one template.

import { useSyncExternalStore } from "react";
import { angles, copyBank, library, type AdPlatform, type Angle, type Format, type LibraryAd, type Row, type Size } from "../data/ads";
import { brandFacts } from "../data/brand";

export type SwipeAd = {
  id: string;
  source: "library" | "yours" | "added";
  advertiser: string;
  platform: AdPlatform;
  format: Format;
  angle: Angle;
  headline: string;
  text: string;
  days?: number;
  versions?: number;
  why: string;
  yours?: string;
  note: string;
  savedAt: number;
};

export type Style = "photo" | "type" | "review" | "ugc";
export const styles: { id: Style; label: string; off?: string }[] = [
  { id: "photo", label: "Photo + headline" },
  { id: "type", label: "Bold type" },
  { id: "review", label: "Review card" },
  { id: "ugc", label: "Phone video look" },
];
/** Styles the brand rules rule out, with the reason. */
export const blockedStyles = [{ label: "Before / after", why: brandFacts.rules.find((r) => r.toLowerCase().includes("before/after")) ?? "Brand rule" }];

export type Brief = { name: string; offer: string; landing: string; angles: Angle[]; hooks: number; formats: Format[]; sizes: Size[]; styles: Style[]; refs: string[] };
export type CreativeStatus = "draft" | "approved" | "rejected" | "published";
export type Flag = { level: "block" | "warn"; text: string };
export type Creative = {
  id: string;
  batchId: string;
  angle: Angle;
  format: Format;
  style: Style;
  headline: string;
  text: string;
  cta: string;
  sizes: Size[];
  score: number;
  flags: Flag[];
  status: CreativeStatus;
  refId?: string;
  campaignId?: string;
};
export type Batch = { id: string; name: string; at: number; brief: Brief };

type State = { swipe: SwipeAd[]; batches: Batch[]; creatives: Creative[] };

const KEY = "gw-creatives";
const day = 86_400_000;
const fromLibrary = (l: LibraryAd, savedAt: number, note = ""): SwipeAd => ({ id: `sw_${l.id}`, source: "library", advertiser: l.advertiser, platform: l.platform, format: l.format, angle: l.angle, headline: l.headline, text: l.text, days: l.days, versions: l.versions, why: l.why, yours: l.yours, note, savedAt });
const initial: State = {
  swipe: [
    fromLibrary(library[0], Date.now() - 12 * day, "Their best runner. Answer with “cleaning included”."),
    fromLibrary(library[3], Date.now() - 5 * day, "Run Nov 1 – Dec 20"),
    fromLibrary(library[5], Date.now() - 3 * day),
  ],
  batches: [],
  creatives: [],
};
const load = (): State => { try { return { ...initial, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return initial; } };
let state: State = load();
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  listeners.forEach((l) => l());
};
let seq = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

export const useCreatives = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => state, () => state);

// ---------- Swipe file ----------

export const inSwipe = (s: State, libraryId: string) => s.swipe.some((x) => x.id === `sw_${libraryId}`);
export function saveToSwipe(ads: LibraryAd[]) {
  const fresh = ads.filter((a) => !inSwipe(state, a.id)).map((a) => fromLibrary(a, Date.now()));
  if (fresh.length) set({ ...state, swipe: [...fresh, ...state.swipe] });
  return fresh.length;
}
/** One of your own ads, kept as a reference. */
export function saveRowToSwipe(r: Row, note = "") {
  if (!r.copy || state.swipe.some((x) => x.id === `sw_${r.id}`)) return;
  const s: SwipeAd = { id: `sw_${r.id}`, source: "yours", advertiser: "You", platform: r.platform, format: r.copy.format, angle: r.copy.angle, headline: r.copy.headline, text: r.copy.text, why: note || "One of your ads.", note: "", savedAt: Date.now() };
  set({ ...state, swipe: [s, ...state.swipe] });
}
export function addSwipe(a: Omit<SwipeAd, "id" | "savedAt" | "source">) {
  set({ ...state, swipe: [{ ...a, id: uid("sw_"), source: "added", savedAt: Date.now() }, ...state.swipe] });
}
export const setSwipeNote = (id: string, note: string) => set({ ...state, swipe: state.swipe.map((x) => (x.id === id ? { ...x, note } : x)) });
export const removeSwipe = (ids: string[]) => set({ ...state, swipe: state.swipe.filter((x) => !ids.includes(x.id)) });

// ---------- Studio ----------

export const blankBrief = (): Brief => ({
  name: "",
  offer: brandFacts.offers[1] ?? "",
  landing: `${brandFacts.website}/new-patients`,
  angles: ["price", "pain", "proof"],
  hooks: 3,
  formats: ["image"],
  sizes: ["1:1", "4:5", "9:16"],
  styles: ["photo", "type", "review"],
  refs: [],
});
export const variationCount = (b: Brief) => b.angles.length * b.hooks * b.formats.length;
export const fileCount = (b: Brief) => b.angles.length * b.hooks * b.formats.reduce((a, f) => a + (f === "search" ? 1 : b.sizes.length), 0);
export const costOf = (b: Brief) => fileCount(b) * 0.04;

// How each angle and format has done (your account, then the market). Real
// build: learned from your ad results and how long similar ads run.
const angleBase: Record<Angle, number> = { price: 82, pain: 78, deadline: 76, proof: 74, convenience: 70, compare: 66, authority: 58 };
const formatAdj: Record<Format, number> = { image: 0, carousel: -3, video: 2, search: 4 };
const jitter = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return (Math.abs(h) % 13) - 6; };

export function checks(c: Pick<Creative, "angle" | "format" | "headline" | "text">): Flag[] {
  const f: Flag[] = [];
  if (c.format !== "search" && c.angle === "pain" && c.headline.includes("?"))
    f.push({ level: "block", text: "Asks about their health. Meta rejects ads that imply someone has a condition; state the service instead (“Same-day toothache visits”)." });
  if (c.format === "search") c.headline.split(" | ").filter((p) => p.length > 30).forEach((p) => f.push({ level: "block", text: `“${p}” is ${p.length} characters; Google headlines stop at 30.` }));
  if (c.format !== "search" && c.text.length > 125) f.push({ level: "warn", text: `Text folds into “… more” after 125 characters on Instagram (this is ${c.text.length}).` });
  if (/painless|guarantee/i.test(c.headline + c.text)) f.push({ level: "block", text: "Breaks a brand rule: no promises of results or “painless” claims." });
  return f;
}

export function generate(brief: Brief): Batch {
  const n = state.batches.length + 1;
  const batch: Batch = { id: uid("b_"), name: brief.name.trim() || `Batch ${n} · ${brief.angles.map((a) => angles[a].label).join(", ")}`, at: Date.now(), brief };
  const refs = state.swipe.filter((s) => brief.refs.includes(s.id));
  const used = state.creatives.length;
  const out: Creative[] = [];
  brief.angles.forEach((angle) => {
    const bank = copyBank[angle];
    for (let i = 0; i < brief.hooks; i++) {
      brief.formats.forEach((format, fi) => {
        const k = i + used;
        const headline = format === "search" ? [bank.search[k % bank.search.length], brandFacts.name].join(" | ") : bank.hooks[k % bank.hooks.length];
        const text = bank.texts[(k + fi) % bank.texts.length];
        const ref = refs.find((r) => r.angle === angle);
        const c = { angle, format, headline, text };
        out.push({
          id: uid("cr_"), batchId: batch.id, ...c, style: brief.styles[(i + fi) % Math.max(1, brief.styles.length)] ?? "photo",
          cta: angle === "pain" ? "Call now" : angle === "authority" ? "Learn more" : "Book now",
          sizes: format === "search" ? [] : brief.sizes,
          score: Math.max(30, Math.min(97, angleBase[angle] + formatAdj[format] + jitter(headline + format) + (ref ? 5 : 0))),
          flags: checks(c), status: "draft", refId: ref?.id,
        });
      });
    }
  });
  set({ ...state, batches: [batch, ...state.batches], creatives: [...out, ...state.creatives] });
  return batch;
}

/** More hooks for the same angle and format as the given creatives, in a new batch. */
export function moreLike(ids: string[]) {
  const picked = state.creatives.filter((c) => ids.includes(c.id));
  if (!picked.length) return null;
  const base = state.batches.find((b) => b.id === picked[0].batchId)?.brief ?? blankBrief();
  return generate({ ...base, name: `More like ${picked.length === 1 ? `“${picked[0].headline}”` : `${picked.length} picks`}`, angles: [...new Set(picked.map((c) => c.angle))], formats: [...new Set(picked.map((c) => c.format))], hooks: 3 });
}

export const setCreativeStatus = (ids: string[], status: CreativeStatus, campaignId?: string) =>
  set({ ...state, creatives: state.creatives.map((c) => (ids.includes(c.id) ? { ...c, status, campaignId: campaignId ?? c.campaignId } : c)) });
export function editCreative(id: string, patch: Partial<Pick<Creative, "headline" | "text" | "cta">>) {
  set({ ...state, creatives: state.creatives.map((c) => (c.id === id ? { ...c, ...patch, flags: checks({ ...c, ...patch }) } : c)) });
}
export const removeCreatives = (ids: string[]) => set({ ...state, creatives: state.creatives.filter((c) => !ids.includes(c.id)) });
export const removeBatch = (id: string) => set({ ...state, batches: state.batches.filter((b) => b.id !== id), creatives: state.creatives.filter((c) => c.batchId !== id || c.status === "published") });

/** Quick rewrites. Real build: Claude, with the brand voice. */
export function rewrite(text: string, how: "shorter" | "punchier" | "local") {
  if (how === "shorter") return text.split(/(?<=[.!?])\s/)[0];
  if (how === "punchier") return text.replace(/^(\w)/, (m) => m.toUpperCase()).replace(/\.$/, "") + ". Book in 2 minutes.";
  return text.includes("Austin") ? text : `${text.replace(/\.$/, "")}, right here in South Austin.`;
}

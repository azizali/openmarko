// The swipe file: formats and ideas worth reusing. Some come built in, some are
// saved from trends the scanner found, some the user writes. Any of them can be
// turned into a post in the brand voice.

import { useSyncExternalStore } from "react";
import { trends, type ChannelId, type Trend } from "../data/social";

export type SwipeKind = "Format" | "Hook" | "Idea" | "Series";
export type Swipe = {
  id: string;
  title: string;
  kind: SwipeKind;
  why: string; // why it works
  structure: string[]; // the beats to follow
  example: string; // a version for this business
  channels: ChannelId[];
  source: "starter" | "trend" | "mine";
  trendId?: string;
  used: number;
};

const starters: Swipe[] = [
  {
    id: "sw1", title: "Myth vs. fact", kind: "Format", source: "starter", used: 3, channels: ["instagram", "facebook"],
    why: "People love being let in on what's true. It's easy to save and share with someone who believes the myth.",
    structure: ["State a common myth in the hook", "“Actually…” with the plain fact", "One sentence on why it matters", "Ask: what myth should we bust next?"],
    example: "Myth: if your gums bleed, stop flossing. Actually, it's a sign to keep going; most bleeding stops within two weeks.",
  },
  {
    id: "sw2", title: "3 questions to ask before you book", kind: "Format", source: "starter", used: 1, channels: ["instagram", "facebook", "google"],
    why: "Helps people choose well, even if they don't choose you, and that's what builds trust.",
    structure: ["Hook: “Before you book a [service], ask these 3 things”", "Three short questions, one line each", "What a good answer sounds like", "Soft close: we're happy to answer all three"],
    example: "Before you book Invisalign, ask: Who checks my progress? What does the retainer cost? What happens if a tray doesn't fit?",
  },
  {
    id: "sw3", title: "Meet the team Monday", kind: "Series", source: "starter", used: 6, channels: ["instagram", "facebook", "linkedin"],
    why: "A face makes a first visit less scary. A weekly series is easy to keep up and people follow along.",
    structure: ["Photo of one person at work", "Name, role and how long they've been here", "One thing patients don't know about them", "What they love about the job"],
    example: "Meet Sam, our newest hygienist. Ask her about the sourdough she brings in on Fridays.",
  },
  {
    id: "sw4", title: "The price, upfront", kind: "Idea", source: "starter", used: 0, channels: ["facebook", "google", "x"],
    why: "Not knowing the cost is the biggest reason people put off the dentist. Saying it plainly stands out.",
    structure: ["Hook: “What a [service] costs here, without insurance”", "The price, and what's included", "What changes the price", "How to ask for a quote"],
    example: "A new patient exam and cleaning is $129 without insurance. That includes X-rays when they're due.",
  },
  {
    id: "sw5", title: "Answer a real question", kind: "Hook", source: "starter", used: 2, channels: ["tiktok", "instagram", "x"],
    why: "Questions people already asked on Reddit or in reviews are proven interest. Answering one on camera feels personal.",
    structure: ["Show the question on screen (no names)", "Answer in 20 seconds", "One tip they can use today", "“Send us yours”"],
    example: "Someone asked: does whitening toothpaste work? Short answer: for coffee stains, a little.",
  },
];

let items: Swipe[] = starters;
const listeners = new Set<() => void>();
const set = (next: Swipe[]) => { items = next; listeners.forEach((l) => l()); };
export const useSwipes = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => items, () => items);

export const savedTrend = (trendId: string) => items.some((s) => s.trendId === trendId);

/** Keeps a trend's format and insight, so it can be reused after the trend fades. */
export function saveTrend(t: Trend) {
  if (savedTrend(t.id)) return;
  set([{
    id: `sw${Date.now().toString(36)}`, title: t.title.replace(/[“”]/g, ""), kind: t.kind === "Format" ? "Format" : "Idea", source: "trend", trendId: t.id, used: 0,
    why: t.insight, structure: t.remix.scenes ?? [t.remix.hook, t.remix.body, t.remix.cta], example: t.angle, channels: t.bestFor,
  }, ...items]);
}
export function unsaveTrend(trendId: string) { set(items.filter((s) => s.trendId !== trendId)); }
export function saveSwipe(s: Swipe) { set(items.some((x) => x.id === s.id) ? items.map((x) => (x.id === s.id ? s : x)) : [s, ...items]); }
export function removeSwipe(id: string) { set(items.filter((s) => s.id !== id)); }
export const markUsed = (id: string) => set(items.map((s) => (s.id === id ? { ...s, used: s.used + 1 } : s)));

export const blankSwipe = (): Swipe => ({ id: `sw${Date.now().toString(36)}`, title: "", kind: "Format", why: "", structure: [""], example: "", channels: ["instagram"], source: "mine", used: 0 });

/**
 * A swipe as the post drawer's input. Saved trends use the trend itself;
 * others become a one-off brief built from their beats and example.
 */
export function asTrend(s: Swipe): Trend {
  const t = s.trendId && trends.find((x) => x.id === s.trendId);
  if (t) return t;
  const [hook, ...rest] = (s.example || s.title).split(/(?<=[.?!])\s/);
  return {
    id: s.id, kind: s.kind === "Hook" ? "Format" : "Topic", title: s.title, source: "Your swipe file", velocity: `Used ${s.used}×`, fit: 100,
    seen: s.structure.join(" → "), insight: s.why, angle: s.example, bestFor: s.channels, from: [],
    remix: { hook, playfulHook: hook, body: rest.join(" "), expertLine: "", cta: "", hashtags: [], format: s.kind === "Series" ? "Weekly series post" : "Post", scenes: s.structure },
  };
}

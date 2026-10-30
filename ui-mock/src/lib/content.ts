// Website articles, from idea to published. Posts (Google profile and social)
// live in lib/social.ts. Module store so the Articles page and the report preview see the same list.

import { useSyncExternalStore } from "react";
import { blogPosts, contentArchive, keywords, type ContentItem, type ContentStatus } from "../data/mock";
import { fmt } from "../components/ui";

export type ContentType = "article" | "post";
export type PlanItem = ContentItem & { type: ContentType; why?: string; isNew?: boolean };

let items: PlanItem[] = [
  ...blogPosts.map((b) => ({ ...b, type: "article" as const })),
  ...contentArchive.filter((c) => c.type === "article"),
];
const listeners = new Set<() => void>();
const set = (next: PlanItem[]) => { items = next; listeners.forEach((l) => l()); };

export const useContent = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => items, () => items);

const nextStatus: Partial<Record<ContentStatus, ContentStatus>> = { idea: "draft", draft: "published", scheduled: "published" };

export function advanceContent(id: string) {
  set(items.map((i) => {
    const next = i.id === id ? nextStatus[i.status] : undefined;
    return next ? { ...i, status: next, date: next === "draft" ? "Just now" : "Today", isNew: false } : i;
  }));
}

export function removeContent(id: string) {
  set(items.filter((i) => i.id !== id));
}

const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const service = (term: string) => term.replace(/ austin$| near me$| south austin$/, "");
const articleTitles = [
  (t: string) => `${cap(service(t))} in Austin: cost, timing and what to expect`,
  (t: string) => `5 questions to ask before choosing ${service(t)}`,
  (t: string) => `${cap(service(t))}: myths vs. facts`,
];

/**
 * Suggests `n` ideas for keywords that have the least content aimed at them, biggest search volume first.
 * Real build: an LLM pass over the keyword's top results and the questions people ask.
 */
export function suggestIdeas(n = 3, keywordId?: string) {
  const count = (id: string) => items.filter((i) => i.keywordId === id).length;
  const pool = keywords
    .filter((k) => !keywordId || k.id === keywordId)
    .sort((a, b) => count(a.id) - count(b.id) || b.volume - a.volume);
  const titles = new Set(items.map((i) => i.title));
  const fresh: PlanItem[] = [];
  for (let round = 0; fresh.length < n && round < 3; round++) {
    for (const k of pool) {
      if (fresh.length >= n) break;
      const type: ContentType = "article";
      const title = articleTitles[round % articleTitles.length](k.term);
      if (titles.has(title)) continue;
      titles.add(title);
      const covered = count(k.id);
      fresh.push({
        id: `c${Date.now()}_${fresh.length}`, type, title, status: "idea", keywordId: k.id, date: "Suggested", isNew: true,
        words: 1200 + (k.volume % 5) * 100,
        why: `${fmt(k.volume)} searches/mo · ${covered ? `${covered} piece${covered === 1 ? "" : "s"} so far` : "nothing aimed at it yet"}`,
      });
    }
  }
  set([...fresh, ...items]);
  return fresh.length;
}

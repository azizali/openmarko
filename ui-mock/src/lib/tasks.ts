// The unified to-do model (this replaces the old Action plan): improvements,
// site fixes, review replies and content all become Tasks. Their run state lives in a tiny module store so
// fixing something on one page shows as done everywhere else.

import { useSyncExternalStore } from "react";
import { actions, auditIssues, auditKeywordLinks, blogPosts, gbpPosts, reviews } from "../data/mock";

export type Kind = "action" | "fix" | "review" | "content";
export type Impact = "High" | "Medium" | "Low";
export type Task = {
  id: string;
  kind: Kind;
  title: string;
  why: string;
  impact: Impact;
  keywordIds: string[];
  cta: string;
  auto: boolean;
  preview?: { label: string; before?: string; after: string };
  evidence?: string[];
  steps: string[];
  href?: string;
  via: string;
  effort: string;
};

const impactRank: Record<Impact, number> = { High: 0, Medium: 1, Low: 2 };

function buildTasks(): Task[] {
  const fromActions: Task[] = actions.map((a) => ({
    id: a.id, kind: "action", title: a.title, why: a.rationale, impact: a.impact, keywordIds: a.keywordIds ?? [],
    cta: a.executor === "Manual" ? "Start" : "Apply", auto: a.executor !== "Manual",
    preview: a.preview, evidence: a.evidence, steps: a.steps, via: a.executor, effort: a.effort === "Auto" ? "Automatic" : a.effort,
  }));
  const fromAudit: Task[] = auditIssues
    .filter((i) => i.autoFix && i.id !== "i2") // i2 duplicates action a7
    .map((i) => ({
      id: i.id, kind: "fix", title: i.title, why: i.why,
      impact: i.severity === "critical" ? "High" : i.severity === "warning" ? "Medium" : "Low",
      keywordIds: auditKeywordLinks[i.id] ?? [], cta: "Fix", auto: true,
      preview: { label: `Change on ${i.pages.length} page${i.pages.length > 1 ? "s" : ""}`, before: i.autoFix!.before, after: i.autoFix!.after },
      steps: ["Apply via WordPress", "Purge cache", "Re-crawl affected pages"], href: `/audit/${i.id}`, via: "WordPress", effort: "Automatic",
    }));
  const fromReviews: Task[] = reviews
    .filter((r) => !r.replied)
    .map((r) => ({
      id: r.id, kind: "review", title: `Reply to ${r.author} · ${r.rating}★`, why: `“${r.text}”`,
      impact: r.rating <= 2 ? "High" : "Low", keywordIds: [], cta: "Reply", auto: true,
      preview: {
        label: "Suggested reply",
        after: r.rating >= 4
          ? `Thank you, ${r.author.split(" ")[0]}! We're glad you had a great visit at our South Congress office. See you next time. — The Maple & Main team`
          : `Hi ${r.author.split(" ")[0]}, I'm sorry about the billing confusion. Our office manager will call you this week to make it right. — Dr. Patel`,
      },
      steps: ["Publish reply to Google"], href: "/profile", via: "Google Business Profile API", effort: "Automatic",
    }));
  const fromContent: Task[] = [
    { id: "t_p1", kind: "content", title: `Publish post: ${gbpPosts[0].title}`, why: "Your profile hasn't posted in 3 weeks. Leaders post weekly.", impact: "Medium", keywordIds: [gbpPosts[0].keywordId], cta: "Publish", auto: true, preview: { label: "Business Profile post", after: "Chipped a tooth or sudden pain? We keep same-day emergency slots open every weekday on South Congress. Tap Call and we'll get you seen today." }, steps: ["Publish to Google Business Profile"], href: "/social/posts", via: "Google Business Profile API", effort: "Automatic" },
    { id: "t_s1", kind: "content", title: "Post this week's trend: “5 things I'd never do as a dentist”", why: "Insider lists are up 340% on TikTok and Reels this week, and it fits your voice. About 15 minutes to film.", impact: "Medium", keywordIds: [], cta: "Start", auto: false, steps: ["Open Social scanner → Trending and press Remix in my voice", "Film the 5 short clips from the shot list", "Schedule for Wed 8:00 PM, your best time on TikTok"], href: "/social/scanner?tab=trending", via: "Instagram & TikTok", effort: "15 min" },
    { id: "t_c1", kind: "content", title: "Reply to 3 people asking for a dentist near you", why: "On r/Austin, a South Austin parents group and Nextdoor, all within 1.5 miles. Replies are written; you copy, open and paste.", impact: "High", keywordIds: [], cta: "Start", auto: false, steps: ["Open Social scanner → Reply", "For each: Copy reply & open, paste it, then Mark replied"], href: "/social/scanner", via: "Reddit, Facebook groups, Nextdoor", effort: "10 min" },
    { id: "t_b1", kind: "content", title: `Write article: ${blogPosts[0].title}`, why: "880 people a month ask this. None of the top 3 dentists answer it on their site.", impact: "Medium", keywordIds: [blogPosts[0].keywordId], cta: "Draft", auto: true, steps: ["Generate outline from top results", "Write 1,400-word draft", "Save to WordPress as draft"], href: "/keywords", via: "WordPress", effort: "Automatic" },
  ];
  return [...fromActions, ...fromAudit, ...fromReviews, ...fromContent].sort((a, b) => impactRank[a.impact] - impactRank[b.impact]);
}

export const tasks = buildTasks();

// ---------- Run state ----------

export type RunState = Record<string, "running" | "done" | "dismissed">;
// Actions already applied before this session start out done.
let runState: RunState = Object.fromEntries(actions.filter((a) => a.status === "done" || a.status === "running").map((a) => [a.id, "done" as const]));
const listeners = new Set<() => void>();
const set = (next: RunState) => { runState = next; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function runTasks(ids: string[]) {
  set({ ...runState, ...Object.fromEntries(ids.map((id) => [id, "running" as const])) });
  setTimeout(() => set({ ...runState, ...Object.fromEntries(ids.map((id) => [id, "done" as const])) }), 1100);
}

export function dismissTask(id: string) {
  set({ ...runState, [id]: "dismissed" });
}

export function undoTask(id: string) {
  const next = { ...runState };
  delete next[id];
  set(next);
}

export const getRunState = () => runState;

export function useRunState() {
  return useSyncExternalStore(subscribe, () => runState, () => runState);
}

export const openTasksFor = (state: RunState, kwId?: string) =>
  tasks.filter((t) => state[t.id] !== "done" && state[t.id] !== "dismissed" && (!kwId || t.keywordIds.includes(kwId)));

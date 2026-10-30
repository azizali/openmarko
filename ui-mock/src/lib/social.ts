// Posts from draft to published. A Post goes to one or more Accounts, with a
// version for each. Module store, like tasks and content, so Marko, Social
// scanner and Posts & calendar all see the same list.

import { useSyncExternalStore } from "react";
import { bestTime, draftFor, platformOf, trends, type AccountId, type ToneTweak, type Trend } from "../data/social";

export type PostStats = { views: number; likes: number; comments: number; shares: number };
const zero: PostStats = { views: 0, likes: 0, comments: 0, shares: 0 };
/** A post's results added up across its Accounts. */
export const totals = (p: SocialPost): PostStats => Object.values(p.stats ?? {}).reduce<PostStats>((a, s) => (s ? { views: a.views + s.views, likes: a.likes + s.likes, comments: a.comments + s.comments, shares: a.shares + s.shares } : a), zero);
export const reactions = (s: PostStats) => s.likes + s.comments + s.shares;

export type PostStatus = "draft" | "scheduled" | "published";
export type SocialPost = {
  id: string;
  title: string;
  trendId?: string;
  accounts: AccountId[];
  texts: Partial<Record<AccountId, string>>; // one version per Account
  format: string;
  status: PostStatus;
  day: number; // days from today (0 = today); published posts are negative (days ago)
  time: string;
  stats?: Partial<Record<AccountId, PostStats>>; // results per Account, from each Account's own insights
};

const t = (id: string) => trends.find((x) => x.id === id)!;
const texts = (trendId: string, ids: AccountId[]) => Object.fromEntries(ids.map((a) => [a, draftFor(t(trendId), platformOf(a))]));

let posts: SocialPost[] = [
  { id: "sp1", title: "Change your clocks, change your toothbrush", trendId: "tr2", accounts: ["instagram", "facebook"], texts: texts("tr2", ["instagram", "facebook"]), format: t("tr2").remix.format, status: "scheduled", day: 1, time: "9:00 AM" },
  { id: "sp2", title: "Things we'll never try to sell you", trendId: "tr3", accounts: ["facebook"], texts: texts("tr3", ["facebook"]), format: t("tr3").remix.format, status: "draft", day: 6, time: "12:15 PM" },
  { id: "sp3", title: "Our new hygienist, Sam", accounts: ["instagram", "facebook"], texts: { instagram: "Meet Sam, our new hygienist. Ask about the sourdough.\n\n#southcongress #austin", facebook: "Meet Sam, our new hygienist. Ask about the sourdough." }, format: "Photo", status: "published", day: -3, time: "7:30 PM", stats: { instagram: { views: 2410, likes: 178, comments: 24, shares: 6 }, facebook: { views: 710, likes: 36, comments: 7, shares: 3 } } },
  // Google profile posts (this used to live on the Content board).
  { id: "gp1", title: "Same-day emergency appointments on South Congress", accounts: ["google"], texts: { google: "Chipped a tooth or sudden pain? We keep same-day emergency slots open every weekday on South Congress. Tap Call and we'll get you seen today." }, format: "Update · Call button", status: "draft", day: 3, time: "9:00 AM" },
  { id: "gp2", title: "Free Invisalign consult this November", accounts: ["google"], texts: { google: "Thinking about straighter teeth? Invisalign consults are free through November, with a 3D scan so you can see the result first. Tap Book to pick a time." }, format: "Offer · Book button", status: "scheduled", day: 10, time: "9:00 AM" },
  { id: "gp3", title: "Meet Dr. Patel", accounts: ["google"], texts: { google: "Dr. Anika Patel has looked after South Congress smiles for 12 years. Ask her about anything; she'll explain it without the jargon." }, format: "Update · Learn more", status: "scheduled", day: 17, time: "9:00 AM" },
  { id: "gp4", title: "Whitening before the holidays", accounts: ["google"], texts: { google: "Holiday photos coming up? Whitening takes one visit and about an hour." }, format: "Offer", status: "published", day: -9, time: "9:00 AM", stats: { google: { views: 640, likes: 0, comments: 0, shares: 0 } } },
  { id: "gp5", title: "Now booking Saturday cleanings", accounts: ["google"], texts: { google: "Saturday cleanings are back, 8 AM to 1 PM." }, format: "Update", status: "published", day: -23, time: "9:00 AM", stats: { google: { views: 512, likes: 0, comments: 0, shares: 0 } } },
  { id: "sp4", title: "Halloween candy: the least-bad options", accounts: ["tiktok", "instagram"], texts: { tiktok: "Ranking Halloween candy as a dentist #dentisttok #halloween", instagram: "Ranking Halloween candy as a dentist. Chocolate wins. Sticky stuff loses.\n\n#halloween #austin" }, format: "Reel · 22s", status: "published", day: -2, time: "8:00 PM", stats: { tiktok: { views: 15200, likes: 1410, comments: 121, shares: 262 }, instagram: { views: 3200, likes: 220, comments: 21, shares: 26 } } },
];

const listeners = new Set<() => void>();
const set = (next: SocialPost[]) => { posts = next; listeners.forEach((l) => l()); };
export const useSocialPosts = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => posts, () => posts);
export const getSocialPost = (id: string) => posts.find((p) => p.id === id);

// The mock's "today" is Friday, Oct 30, 2026.
export const TODAY = new Date(2026, 9, 30);
const weekday: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
/** Days from today until the next given weekday (today counts). */
const until = (name: string) => (weekday[name] - TODAY.getDay() + 7) % 7;
export const dateOf = (day: number) => { const d = new Date(TODAY); d.setDate(d.getDate() + day); return d; };

/** Turns a trend into a draft post for the given Accounts, at the first one's best time. Texts the user edited win. */
export function remixTrend(trend: string | Trend, chs: AccountId[], tweaks: ToneTweak[] = [], edited: Partial<Record<AccountId, string>> = {}): SocialPost {
  const tr = typeof trend === "string" ? t(trend) : trend;
  const trendId = tr.id;
  const [d, ...rest] = bestTime[platformOf(chs[0])].split(" ");
  const post: SocialPost = {
    id: `sp${Date.now().toString(36)}`, title: tr.remix.hook.replace(/[.?]$/, ""), trendId, accounts: chs,
    texts: Object.fromEntries(chs.map((c) => [c, edited[c] ?? draftFor(tr, platformOf(c), tweaks)])), format: tr.remix.format,
    status: "draft", day: until(d), time: rest.join(" "),
  };
  set([post, ...posts]);
  return post;
}

export function savePost(p: SocialPost) { set(posts.some((x) => x.id === p.id) ? posts.map((x) => (x.id === p.id ? p : x)) : [p, ...posts]); }
export function schedulePost(id: string) { set(posts.map((p) => (p.id === id ? { ...p, status: "scheduled" } : p))); }
export function unschedulePost(id: string) { set(posts.map((p) => (p.id === id ? { ...p, status: "draft" } : p))); }
export function publishNow(id: string) { set(posts.map((p) => (p.id === id ? { ...p, status: "published", day: 0, time: "Just now", stats: Object.fromEntries(p.accounts.map((c) => [c, zero])) } : p))); }
export function removePost(id: string) { set(posts.filter((p) => p.id !== id)); }

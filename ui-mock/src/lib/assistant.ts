// Marko, the assistant. Chats open in the ⌘J panel (with a list of
// past chats) and start from Home, ⌘K or the floating button. Answers are text plus blocks the UI renders (task
// rows with Apply/Undo, maps, stats, links); every change goes through the
// same task store as To-do, so it shows as done everywhere.
//
// Mock: respond() matches intents against the mock data. Real build: send the
// conversation and page context to a backend route that calls Claude with
// tools mapped to the same executors (GBP API, WordPress, citation partners),
// and stream these same blocks back. Changes Settings → Autopilot hasn't
// allowed stay as task rows that wait for a click.

import { useSyncExternalStore } from "react";
import { competitors, gbpInsights, gridStats, keywords, reports, reviews, type Keyword } from "../data/mock";
import { citations } from "../data/authority";
import { aiVisibility } from "../data/ai";
import { scanFor } from "../components/KeywordTable";
import { startRun } from "./runs";
import { getRunState, openTasksFor, runTasks, tasks } from "./tasks";
import { mainAccount, draftFor, trends, type SocialPlatform, type ToneTweak, type Trend, platformMeta, platformOf as accountPlatform } from "../data/social";
import { dateOf, getSocialPost, remixTrend, savePost, schedulePost } from "./social";
import { skillName, skillOn } from "./skills";
import { accountConnected } from "./setup";
import { platformOf } from "../data/scanner";
import { openOpportunities } from "./scanner";
import { saveTrend, savedTrend } from "./swipes";

export type Block =
  | { type: "text"; text: string }
  | { type: "tasks"; ids: string[] }
  | { type: "map"; keywordId: string }
  | { type: "stats"; items: { label: string; value: string; note?: string; tone?: "good" | "bad" }[] }
  | { type: "links"; items: { label: string; to: string }[] }
  | { type: "done"; text: string }
  | { type: "post"; postId: string };

export type Message = { id: string; role: "user" | "marko"; blocks: Block[]; followUps?: string[]; skills?: string[] };
export type PageContext = { label: string; path: string; keywordId?: string };

export type Chat = { id: string; title: string; page: string; updated: number; messages: Message[]; lastTaskIds: string[] };

// The open chat's messages live on state for rendering; every chat (the open one
// included) is also kept in `chats`, newest first, and saved in this browser.
type State = {
  open: boolean; wide: boolean; thinking: boolean; view: "chat" | "history";
  chatId: string; messages: Message[]; lastTaskIds: string[]; chats: Chat[];
};
const KEY = "gw-marko-chats";
let seq = 0;
const id = (p = "m") => `${p}${Date.now().toString(36)}${++seq}`;

function loadChats(): Chat[] | null {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Chat[]) : null; } catch { return null; }
}
function saveChats(chats: Chat[]) {
  try { localStorage.setItem(KEY, JSON.stringify(chats)); } catch {}
}

let state: State = { open: false, wide: false, thinking: false, view: "chat", chatId: id("c"), messages: [], lastTaskIds: [], chats: [] };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  const prev = state.chats;
  state = { ...state, ...patch };
  if (state.chats !== prev) saveChats(state.chats);
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useAssistant = () => useSyncExternalStore(subscribe, () => state, () => state);

export const openAssistant = () => set({ open: true });
export const closeAssistant = () => set({ open: false });
export const toggleAssistant = () => set({ open: !state.open });
export const setWide = (wide: boolean) => set({ wide });
export const showHistory = (on: boolean) => set({ view: on ? "history" : "chat" });

export const newChat = () => set({ chatId: id("c"), messages: [], lastTaskIds: [], wide: false, view: "chat" });
export function openChat(chatId: string) {
  const c = state.chats.find((x) => x.id === chatId);
  if (c) set({ open: true, chatId, messages: c.messages, lastTaskIds: c.lastTaskIds, view: "chat", wide: c.messages.some((m) => m.blocks.some((b) => b.type === "map")) });
}
export function deleteChat(chatId: string) {
  set({ chats: state.chats.filter((c) => c.id !== chatId) });
  if (state.chatId === chatId) set({ chatId: id("c"), messages: [], lastTaskIds: [] });
}

/** Lets "do all three" refer to tasks shown outside the chat, like Home's This week list. */
export const primeTasks = (ids: string[]) => { if (!state.messages.length) state = { ...state, lastTaskIds: ids }; };

/** Writes a chat's messages into the list (moving it to the top) and, if it's open, onto state. */
function commit(chatId: string, messages: Message[], lastTaskIds: string[], page: string, extra: Partial<State> = {}) {
  const old = state.chats.find((c) => c.id === chatId);
  const first = messages.find((m) => m.role === "user")?.blocks[0];
  const title = old?.title ?? (first?.type === "text" ? first.text.slice(0, 60) : "New chat");
  const chat: Chat = { id: chatId, title, page: old?.page ?? page, updated: Date.now(), messages, lastTaskIds };
  set({ ...extra, chats: [chat, ...state.chats.filter((c) => c.id !== chatId)], ...(state.chatId === chatId ? { messages, lastTaskIds } : {}) });
}

/** Sends a message as the user and replies after a short "thinking" beat. */
export function ask(text: string, ctx: PageContext) {
  const q = text.trim();
  if (!q || state.thinking) return;
  const chatId = state.chatId;
  commit(chatId, [...state.messages, { id: id(), role: "user", blocks: [{ type: "text", text: q }] }], state.lastTaskIds, ctx.label, { open: true, thinking: true, view: "chat" });
  setTimeout(() => {
    const chat = state.chats.find((c) => c.id === chatId);
    if (!chat) { set({ thinking: false }); return; } // deleted while thinking
    const reply = respond(q, ctx, chat.lastTaskIds);
    const taskBlock = reply.blocks.find((b) => b.type === "tasks");
    commit(chatId, [...chat.messages, reply], taskBlock && taskBlock.type === "tasks" ? taskBlock.ids : chat.lastTaskIds, ctx.label, {
      thinking: false,
      // Maps need room: widen the panel when an answer carries one.
      ...(state.chatId === chatId && reply.blocks.some((b) => b.type === "map") ? { wide: true } : {}),
    });
  }, 650);
}

/** Starter prompts for the page the user is on. */
export function suggestionsFor(ctx: PageContext): string[] {
  const kw = keywords.find((k) => k.id === ctx.keywordId);
  if (kw) return [`Why did “${kw.term}” move?`, `How do I get to #1 for “${kw.term}”?`, "Rescan my rankings"];
  if (ctx.path.startsWith("/rankings") || ctx.path.startsWith("/competitors")) return ["Which keywords dropped?", "How do I beat Bright Smile Austin?", "Rescan my rankings"];
  if (ctx.path.startsWith("/profile") || ctx.path.startsWith("/content")) return ["Reply to my 5-star reviews", "Which reviews need a reply?", "Write this week's Google post"];
  if (ctx.path.startsWith("/citations")) return ["Which listings are wrong?", "Fix my citations"];
  if (ctx.path.startsWith("/reports")) return ["Summarize this month", "Email the monthly report"];
  if (ctx.path.startsWith("/ai")) return ["Do AI assistants recommend me?", "What should I do this week?"];
  if (ctx.path.startsWith("/social")) return ["Who should I reply to today?", "What's trending this week?", "Make a TikTok in my voice"];
  return ["What should I do this week?", "Which keywords dropped?", "Reply to my 5-star reviews"];
}

// ---------- Intents ----------

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w));
const open = (ids: string[]) => { const s = getRunState(); return ids.filter((i) => s[i] !== "done" && s[i] !== "dismissed"); };
const solv = (k: Keyword, past = false) => Math.round(gridStats(scanFor(k, 7, past)).solv);

/** A keyword named in the question ("emergency" → "emergency dentist austin"), else the page's. */
function keywordIn(q: string, ctx: PageContext): Keyword | undefined {
  const named = keywords
    .map((k) => ({ k, hits: k.term.split(" ").filter((w) => w.length > 3 && !["austin", "dentist"].includes(w) && q.includes(w)).length }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)[0]?.k;
  return named ?? keywords.find((k) => q.includes(k.term)) ?? keywords.find((k) => k.id === ctx.keywordId);
}

const drops = () =>
  keywords
    .filter((k) => k.local !== null && k.localPrev !== null && k.local > k.localPrev)
    .sort((a, b) => (b.local! - b.localPrev!) - (a.local! - a.localPrev!));

/** A Marko answer. `skills` names the writing skills it used (shown under the answer). */
const reply = (blocks: Block[], followUps?: string[], skills?: string[]): Message => ({ id: id(), role: "marko", blocks, followUps, skills });
/** Marko won't write with a skill the user turned off. */
const off = (skill: string): Message | null =>
  skillOn(skill) ? null : reply([{ type: "text", text: `The “${skillName(skill)}” skill is turned off, so I won't write that. Turn it back on in Skills.` }, { type: "links", items: [{ label: "Skills", to: "/settings/skills" }] }]);

// ---------- Social ----------

let lastPostId: string | null = null; // the draft "schedule it" and "make it shorter" refer to
const quoted = (t: Trend) => (t.title.startsWith("“") ? t.title : `“${t.title}”`);
const when = (day: number, time: string) => `${day === 0 ? "today" : day === 1 ? "tomorrow" : dateOf(day).toLocaleDateString("en-US", { weekday: "long" })} at ${time}`;
const channelNames: [SocialPlatform, string[]][] = [["instagram", ["instagram", "insta", "reel"]], ["tiktok", ["tiktok", "tik tok"]], ["facebook", ["facebook"]], ["linkedin", ["linkedin"]], ["x", ["twitter", "tweet", " on x", "x post", "post on x"]]];

/** The trend a request is about: words from its title or angle, else the best fit. */
function trendIn(q: string): Trend {
  const words = (t: Trend) => `${t.title} ${t.angle}`.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 4);
  return [...trends].map((t) => ({ t, hits: words(t).filter((w) => q.includes(w)).length })).sort((a, b) => b.hits - a.hits || b.t.fit - a.t.fit)[0].t;
}

function socialReply(q: string): Message | null {
  const last = lastPostId ? getSocialPost(lastPostId) : undefined;
  if (last && /^(schedule|post) (it|this|that)\b/.test(q)) {
    schedulePost(last.id);
    return reply([{ type: "done", text: `Scheduled “${last.title}” for ${when(last.day, last.time)}. It's in Posts & calendar.` }], ["What's trending this week?"]);
  }
  const tweak: ToneTweak | null = /shorter/.test(q) ? "shorter" : /funnier|playful|fun\b/.test(q) ? "playful" : /expert|smarter|detail/.test(q) ? "expert" : null;
  if (last && tweak && /\b(it|this|that)\b/.test(q)) {
    const t = trends.find((x) => x.id === last.trendId);
    if (t) {
      savePost({ ...last, texts: Object.fromEntries(last.accounts.map((a) => [a, draftFor(t, accountPlatform(a), [tweak])])) });
      return reply([{ type: "text", text: tweak === "shorter" ? "Shorter version:" : tweak === "playful" ? "More playful, same voice:" : "Added the expert detail:" }, { type: "post", postId: last.id }], ["Schedule it"], ["social-viral"]);
    }
  }

  if (has(q, "swipe file", "save this", "save it", "save that")) {
    const t = last?.trendId ? trends.find((x) => x.id === last.trendId) : undefined;
    if (!t) return reply([{ type: "text", text: "Tell me which idea to keep, or save one from Social scanner → Trending." }, { type: "links", items: [{ label: "Swipe file", to: "/social/swipe" }] }]);
    const was = savedTrend(t.id);
    saveTrend(t);
    return reply([{ type: "done", text: was ? `${quoted(t)} is already in your swipe file.` : `Saved ${quoted(t)} to your swipe file, so you can reuse the format after the trend fades.` }, { type: "links", items: [{ label: "Swipe file", to: "/social/swipe" }] }]);
  }

  if (has(q, "conversation", "reddit", "quora", "nextdoor", "facebook group", "people asking", "reply to today", "who should i reply", "threads")) {
    const top = openOpportunities().slice(0, 3);
    if (!top.length) return reply([{ type: "text", text: "Nothing new to reply to. The next scan runs tonight." }]);
    return reply([
      { type: "text", text: `${top.length} conversation${top.length > 1 ? "s" : ""} worth joining today: ${top.map((o) => `“${o.title}” on ${platformOf(o.platform).name} (${o.community}, ${o.age})`).join("; ")}. Each has a reply written in your voice; copy it, open the post, paste.` },
      { type: "links", items: [{ label: "Open Social scanner", to: "/social/scanner" }] },
    ], ["What's trending this week?"], ["community-reply"]);
  }

  if (has(q, "trend", "viral", "what's working", "whats working", "what's hot")) {
    const top = [...trends].sort((a, b) => b.fit - a.fit).slice(0, 3);
    return reply([
      { type: "text", text: `Three things catching on this week that fit you: ${top.map((t) => `${quoted(t)} (${t.velocity})`).join("; ")}. The first fits you best. ${top[0].insight}` },
      { type: "links", items: [{ label: "All trending ideas", to: "/social/scanner?tab=trending" }] },
    ], [`Remix “${top[0].title.replace(/[“”]/g, "")}”`, "Make a TikTok in my voice"], ["trend-remix"]);
  }

  const named = channelNames.filter(([, ws]) => ws.some((w) => q.includes(w))).map(([c]) => c);
  if (named.length || has(q, "social", "remix", "caption", "carousel")) {
    const t = trendIn(q);
    // Post from the Organization-wide Account on each Platform asked for.
    const wanted = named.length ? named : t.bestFor;
    const on = (p: SocialPlatform) => { const a = mainAccount(p); return !!a && accountConnected(a.id); };
    const notConnected = wanted.filter((p) => !on(p));
    const chs = wanted.filter(on).map((p) => mainAccount(p)!.id);
    if (!chs.length) return reply([{ type: "text", text: `${notConnected.map((p) => platformMeta[p].name).join(" and ")} isn't connected yet.` }, { type: "links", items: [{ label: "Connect it in Settings", to: "/settings/integrations?cat=Social" }] }]);
    const gate = off("social-viral") ?? off("trend-remix");
    if (gate) return gate;
    const post = remixTrend(t.id, chs);
    lastPostId = post.id;
    return reply([
      { type: "text", text: `I built this on ${quoted(t)} (${t.velocity}). ${t.insight} Written in your voice and saved as a draft for ${when(post.day, post.time)}, your best time.${notConnected.length ? ` (${notConnected.map((p) => platformMeta[p].name).join(", ")} isn't connected, so I left it out.)` : ""}` },
      { type: "post", postId: post.id },
    ], ["Schedule it", "Make it shorter", "Make it more playful"], ["trend-remix", "social-viral"]);
  }
  return null;
}

function respond(raw: string, ctx: PageContext, lastTaskIds: string[]): Message {
  const q = raw.toLowerCase();
  const kw = keywordIn(q, ctx);

  // "Do it", "apply all": act on the tasks from the last answer.
  if (/^(yes|yep|ok|sure|go ahead|do (it|them|all|both)|apply (all|them|it|both)|fix (them|all|both|it)|publish (both|all|them|it)|reply to all)\b/.test(q) || has(q, "do all", "apply all")) {
    const left = open(lastTaskIds);
    const ids = left.filter((i) => tasks.find((t) => t.id === i)?.auto);
    const byHand = left.filter((i) => !ids.includes(i));
    if (!left.length) return reply([{ type: "text", text: "Nothing from my last answer is left to apply. Ask me what to do next." }], ["What should I do this week?"]);
    if (ids.length) runTasks(ids);
    return reply([
      ...(ids.length ? [{ type: "done", text: `Applied ${ids.length} change${ids.length > 1 ? "s" : ""}. Each one has an undo here and in To-do.` } as Block] : []),
      ...(byHand.length ? [{ type: "text", text: `${byHand.length === 1 ? "This one needs" : "These need"} you to do it, with steps in To-do:` } as Block, { type: "tasks", ids: byHand } as Block] : []),
    ], ["What should I do this week?", "Rescan my rankings"]);
  }

  const social = socialReply(q);
  if (social) return social;

  if (has(q, "rescan", "scan", "refresh", "re-check")) {
    startRun("rank", { scope: `${keywords.length} keywords · 7×7 grid`, cost: 0.62 });
    return reply([{ type: "done", text: `Started a ranking scan for ${keywords.length} keywords. It takes about 4 minutes; pages update when it finishes.` }], ["Which keywords dropped?"]);
  }

  if (has(q, "more reviews", "get reviews", "review request")) {
    return reply([{ type: "text", text: "Text patients a review link after each visit. Bright Smile Austin gets 14 reviews a month; you get 6." }, { type: "tasks", ids: open(["a5"]) }]);
  }

  if (has(q, "review", "repl")) {
    const gate = off("review-reply");
    if (gate) return gate;
    const five = has(q, "5-star", "5 star", "five", "positive", "good");
    const list = reviews.filter((r) => !r.replied && (!five || r.rating >= 4));
    const ids = open(list.map((r) => r.id));
    if (!ids.length) return reply([{ type: "text", text: "Every review has a reply. Nice work." }], ["How do I get more reviews?"]);
    const low = list.filter((r) => r.rating <= 2).length;
    return reply([
      { type: "text", text: `${ids.length} review${ids.length > 1 ? "s" : ""} ${five ? "rated 4★ or 5★ " : ""}without a reply. I wrote a reply for each in your practice's voice${low ? ". The low rating one is an apology with a call back, so read it before it posts" : ""}.` },
      { type: "tasks", ids },
    ], ["Reply to all of them", "How do I get more reviews?"], ["review-reply"]);
  }

  if (has(q, "citation", "listing", "yelp", "address", "directory", "directories")) {
    const wrong = citations.filter((c) => c.status === "wrong" || c.status === "duplicate");
    const missing = citations.filter((c) => c.status === "missing");
    return reply([
      { type: "text", text: `${wrong.length} listings show wrong details and ${missing.length} directories are missing you. The wrong ones matter most: ${wrong.slice(0, 3).map((c) => `${c.site} (${c.issue})`).join(", ")}.` },
      { type: "tasks", ids: open(["a9"]) },
      { type: "links", items: [{ label: "All citations", to: "/citations" }, { label: "Backlinks", to: "/citations?tab=links" }] },
    ], ["Fix them", "What should I do this week?"]);
  }

  if (has(q, "report", "summar", "this month", "email")) {
    const callsPct = Math.round(((gbpInsights.calls - gbpInsights.callsPrev) / gbpInsights.callsPrev) * 100);
    const emailIt = has(q, "email", "send");
    return reply([
      ...(emailIt ? [{ type: "done", text: `Sent “${reports[0].name}” to ${reports[0].recipients}.` } as Block] : [{ type: "text", text: `This month in one line: calls from Google are up ${callsPct}%, and “invisalign austin” entered the map pack.` } as Block, {
        type: "stats", items: [
          { label: "Calls", value: String(gbpInsights.calls), note: `${callsPct >= 0 ? "+" : ""}${callsPct}%`, tone: callsPct >= 0 ? "good" : "bad" },
          { label: "Directions", value: String(gbpInsights.directions), note: `+${Math.round(((gbpInsights.directions - gbpInsights.directionsPrev) / gbpInsights.directionsPrev) * 100)}%`, tone: "good" },
          { label: "Website clicks", value: String(gbpInsights.websiteClicks), note: `${Math.round(((gbpInsights.websiteClicks - gbpInsights.websiteClicksPrev) / gbpInsights.websiteClicksPrev) * 100)}%`, tone: "bad" },
        ],
      } as Block]),
      { type: "links", items: [{ label: "Open Reports", to: "/reports" }] },
    ], emailIt ? undefined : ["Email the monthly report"], ["report-summary"]);
  }

  if (has(q, "post", "article", "blog", "write", "content")) {
    return reply([
      { type: "text", text: "Your profile hasn't posted in 3 weeks; the dentists above you post weekly. I drafted this week's post, and an article on a question 880 people a month ask." },
      { type: "tasks", ids: open(["t_p1", "t_b1"]) },
      { type: "links", items: [{ label: "Posts & calendar", to: "/social/posts" }, { label: "Articles", to: "/content" }] },
    ], ["Publish both"], ["gbp-post", "blog-article"]);
  }

  if (/\bai\b/.test(q) || has(q, "chatgpt", "gemini", "perplexity")) {
    const v = aiVisibility();
    return reply([
      { type: "text", text: `AI assistants name you in ${Math.round(v.pct)}% of answers to your customers' questions, ${v.pct >= v.prevPct ? "up" : "down"} ${Math.abs(Math.round(v.pct - v.prevPct))} points. They lean on Healthgrades and Yelp, where your listing is missing or wrong.` },
      { type: "links", items: [{ label: "AI answers", to: "/ai" }, { label: "Citations", to: "/citations" }] },
    ], ["Fix my citations"]);
  }

  if (has(q, "compet", "beat", "bright smile", "rival")) {
    const you = competitors.find((c) => c.isYou)!;
    const lead = [...competitors].filter((c) => !c.isYou).sort((a, b) => b.solv - a.solv)[0];
    return reply([
      { type: "text", text: `${lead.name} leads the map pack. The gap is mostly reviews and categories, both of which you can close.` },
      { type: "stats", items: [
        { label: "Reviews", value: `${you.reviews} vs ${lead.reviews}` },
        { label: "New reviews / mo", value: `${you.reviewVelocity} vs ${lead.reviewVelocity}` },
        { label: "Categories", value: `${you.categories.length} vs ${lead.categories.length}` },
      ] },
      { type: "tasks", ids: open(["a1", "a5"]) },
    ], ["Do it"]);
  }

  if (kw || has(q, "drop", "down", "lost", "fell", "worse", "decline")) {
    const k = kw ?? drops()[0];
    if (!k) return reply([{ type: "text", text: "No keyword dropped this week." }]);
    if (!kw && has(q, "which")) {
      const list = drops().slice(0, 4);
      return reply([
        { type: "text", text: `${list.length} keywords slipped in the map pack this week. The biggest is “${list[0].term}”.` },
        { type: "stats", items: list.map((d) => ({ label: d.term, value: `#${d.localPrev} → #${d.local}`, tone: "bad" as const })) },
      ], [`Why did “${list[0].term}” drop?`]);
    }
    const now = solv(k), past = solv(k, true);
    const ids = open(openTasksFor(getRunState(), k.id).map((t) => t.id)).slice(0, 3);
    const moved = k.local !== null && k.localPrev !== null && k.local !== k.localPrev;
    return reply([
      { type: "text", text: `For “${k.term}” you're ${k.local ? `#${k.local} in the map pack` : "not in the map pack"}${moved ? ` (was #${k.localPrev})` : ""} and in the top 3 at ${now}% of nearby points, ${now === past ? "the same as" : now > past ? `up from ${past}%` : `down from ${past}%`} a month ago. You do best near the office and weakest to the north-east.` },
      { type: "map", keywordId: k.id },
      ...(ids.length ? [{ type: "text", text: "These would help most:" } as Block, { type: "tasks", ids } as Block] : []),
    ], ids.length ? ["Do all", "Rescan my rankings"] : ["Rescan my rankings"]);
  }

  if (has(q, "what should", "this week", "next", "priorit", "focus", "help")) {
    const ids = openTasksFor(getRunState()).slice(0, 3).map((t) => t.id);
    return reply([{ type: "text", text: "The three changes that would bring in the most calls, in order:" }, { type: "tasks", ids }], ["Do all", "Why these?"]);
  }

  if (has(q, "why these", "why")) {
    return reply([{ type: "text", text: "I rank changes by how much they move the map pack for your highest-volume keywords, then by effort. Categories and reviews are the strongest map-pack signals you control; site fixes help Google search." }]);
  }

  return reply([{ type: "text", text: "I can look into rankings and competitors, reply to reviews, fix listings, write posts and send reports. Try one of these:" }], ["What should I do this week?", "Which keywords dropped?", "Reply to my 5-star reviews"]);
}

// ---------- Saved chats ----------

// First visit: a few earlier chats so the list isn't empty in the mock.
// They're built from questions that only read data, so seeding changes nothing.
state.chats = loadChats() ?? (() => {
  const day = 86_400_000, now = Date.now();
  const past: [string, string, number][] = [
    ["Which keywords dropped?", "Rankings", 1],
    ["Reply to my 5-star reviews", "Reviews", 3],
    ["Summarize this month", "Reports", 6],
  ];
  return past.map(([q, page, ago]) => {
    const r = respond(q, { label: page, path: "/" }, []);
    const t = r.blocks.find((b) => b.type === "tasks");
    return { id: id("c"), title: q, page, updated: now - ago * day, messages: [{ id: id(), role: "user" as const, blocks: [{ type: "text" as const, text: q }] }, r], lastTaskIds: t && t.type === "tasks" ? t.ids : [] };
  });
})();

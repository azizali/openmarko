// The Member's connected sequencer and every prospect handed to it. Pushing a
// prospect sends it to a campaign with its audit link and numbers as custom
// variables; the sequencer sends, rotates inboxes and warms them up, and its
// webhooks move the lead along here (sent → replied → interested / booked).
// The Outreach page reads these leads as a unibox. Mock: localStorage, with
// timers standing in for webhooks. Real build: a sequencer_connections row per
// Member (API key encrypted), an outreach_leads table keyed by the sequencer's
// lead id, and a webhook endpoint that appends to each lead's thread.

import { useSyncExternalStore } from "react";
import { providers, starterCampaign, workspaceFor, type Campaign, type Inbox, type ProviderId } from "../data/sequencers";
import { defaultSpec, leadersOf, opportunity, searchMarket, specToQuery, type Market, type Opportunity, type Prospect } from "../data/prospects";
import { ensureShare, recordView, shareUrl } from "./shares";
import { fmt } from "../components/ui";

export type LeadStatus = "queued" | "sent" | "replied" | "interested" | "booked" | "not_interested" | "bounced";
export type Msg = { from: "us" | "them"; at: number; inbox: string; subject: string; body: string; step?: number };
export type Lead = {
  auditPath: string; // identity: one lead per audit
  prospectId: string;
  company: string;
  owner: string | null;
  email: string;
  vars: Record<string, string>;
  campaignId: string;
  campaignName: string;
  status: LeadStatus;
  step: number; // last step sent
  addedAt: number;
  lastAt: number;
  unread: boolean;
  thread: Msg[];
};
export type Connection = { provider: ProviderId; workspace: string; keyLast4: string; connectedAt: number; inboxes: Inbox[]; campaigns: Campaign[] };
export type Rules = { defaultCampaign: string | null; review: boolean; verifiedOnly: boolean; alertOnAudit: boolean; bookingUrl: string };
type State = { connection: Connection | null; rules: Rules; leads: Lead[] };

// Sequencer labels map to these (PlusVibe: LEAD_MARKED_AS_INTERESTED, …_MEETING_BOOKED, …_NOT_INTERESTED).
export const statusMeta: Record<LeadStatus, { label: string; tone: "neutral" | "info" | "accent" | "good" | "bad" }> = {
  queued: { label: "Queued", tone: "neutral" },
  sent: { label: "In sequence", tone: "info" },
  replied: { label: "Replied", tone: "accent" },
  interested: { label: "Interested", tone: "good" },
  booked: { label: "Meeting booked", tone: "good" },
  not_interested: { label: "Not interested", tone: "neutral" },
  bounced: { label: "Bounced", tone: "bad" },
};

const KEY = "gw-outreach";
const hr = 3_600_000;
const initial: State = { connection: null, rules: { defaultCampaign: null, review: true, verifiedOnly: true, alertOnAudit: true, bookingUrl: "cal.com/your-agency/15min" }, leads: [] };
const load = (): State => {
  try {
    const s: State = { ...initial, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
    // Leads queued in an earlier visit went out while you were away.
    return { ...s, leads: s.leads.map((l) => (l.status === "queued" ? sendStep(l, s.connection, 1) : l)) };
  } catch { return initial; }
};
let state: State = load();
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  listeners.forEach((l) => l());
};
const patchLead = (path: string, fn: (l: Lead) => Lead) => set({ ...state, leads: state.leads.map((l) => (l.auditPath === path ? fn(l) : l)) });

export const useOutreach = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => state, () => state);
export const leadFor = (s: State, auditPath: string) => s.leads.find((l) => l.auditPath === auditPath);
export const campaignOf = (s: State, id: string | null) => s.connection?.campaigns.find((c) => c.id === id) ?? null;
export const providerName = (s: State) => (s.connection ? providers[s.connection.provider].name : "your sequencer");

export const render = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] ?? m);

// ---------- Connection ----------

export function connect(provider: ProviderId, apiKey: string) {
  const ws = workspaceFor(provider);
  const connection: Connection = { provider, workspace: ws.workspace, keyLast4: apiKey.slice(-4), connectedAt: Date.now(), inboxes: ws.inboxes, campaigns: ws.campaigns };
  set({ ...state, connection, leads: state.leads.length ? state.leads : sampleLeads(connection) });
}

/** Leads already sent keep going in the sequencer; OpenMarko just stops hearing about them. */
export const disconnect = () => set({ ...state, connection: null, rules: { ...state.rules, defaultCampaign: null } });

export function createStarterCampaign() {
  if (!state.connection) return null;
  const c = state.connection.campaigns.find((x) => x.fromOpenMarko) ?? starterCampaign();
  if (!state.connection.campaigns.includes(c)) set({ ...state, connection: { ...state.connection, campaigns: [c, ...state.connection.campaigns] } });
  return c;
}

export const setRules = (patch: Partial<Rules>) => set({ ...state, rules: { ...state.rules, ...patch } });

// ---------- Leads ----------

/** The custom variables a prospect is pushed with. Creates the audit's share link if it has none. */
export type LeadInput = Omit<Lead, "campaignId" | "campaignName" | "status" | "step" | "addedAt" | "lastAt" | "unread" | "thread">;
export function leadFrom(p: Prospect, o: Opportunity, m: Market, auditPath: string, withLink = true): LeadInput | null {
  if (!p.contact.email) return null;
  const owner = p.contact.owner?.name ?? null;
  return {
    auditPath, prospectId: p.id, company: p.name, owner, email: p.contact.email,
    vars: {
      first_name: owner?.split(" ")[0] ?? "there",
      company: p.name,
      city: m.city.split(",")[0],
      keyword: m.keyword,
      map_rank: p.mapRank === null ? "outside the top 20" : `#${p.mapRank}`,
      top_competitor: leadersOf(m).find((l) => l.id !== p.id)?.name ?? "the top 3",
      missed_revenue: `$${fmt(o.missedRevenue)}`,
      quick_win: o.wins[0]?.title.replace(/^./, (c) => c.toLowerCase()) ?? "a few profile fixes",
      // Previews show a placeholder so opening the send dialog doesn't create links.
      audit_url: withLink ? shareUrl(ensureShare(auditPath, p.name).token) : "openmarko.com/a/…",
    },
  };
}

const inboxFor = (c: Connection | null, i: number) => {
  const ready = c?.inboxes.filter((x) => x.status === "ready") ?? [];
  return ready.length ? ready[i % ready.length].email : "your inbox";
};

function sendStep(l: Lead, c: Connection | null, step: number, at = Date.now()): Lead {
  const s = (c?.campaigns.find((x) => x.id === l.campaignId)?.steps ?? starterCampaign().steps)[step - 1];
  if (!s) return l;
  const from = l.thread[0]?.inbox ?? inboxFor(c, l.company.length);
  return { ...l, status: l.status === "queued" ? "sent" : l.status, step, lastAt: at, thread: [...l.thread, { from: "us", at, inbox: from, subject: render(s.subject, l.vars), body: render(s.body, l.vars), step }] };
}

/** Add prospects to a campaign. Returns how many went in; ones already in a campaign are skipped. */
export function pushLeads(items: LeadInput[], campaignId: string) {
  const c = campaignOf(state, campaignId);
  if (!c) return 0;
  const fresh = items.filter((x) => !leadFor(state, x.auditPath));
  const now = Date.now();
  const added: Lead[] = fresh.map((x) => ({ ...x, campaignId, campaignName: c.name, status: "queued", step: 0, addedAt: now, lastAt: now, unread: false, thread: [] }));
  set({ ...state, leads: [...added, ...state.leads] });
  // Stands in for the sequencer's "email sent" webhook.
  setTimeout(() => {
    const paths = new Set(added.map((l) => l.auditPath));
    set({ ...state, leads: state.leads.map((l) => (paths.has(l.auditPath) && l.status === "queued" ? sendStep(l, state.connection, 1) : l)) });
  }, 3000);
  return added.length;
}

export const setStatus = (path: string, status: LeadStatus) => patchLead(path, (l) => ({ ...l, status, unread: false }));
export const markRead = (path: string) => patchLead(path, (l) => (l.unread ? { ...l, unread: false } : l));
export const removeLead = (path: string) => set({ ...state, leads: state.leads.filter((l) => l.auditPath !== path) });

/** Reply from the same inbox the thread started in, through the sequencer's unibox. */
export function reply(path: string, body: string) {
  patchLead(path, (l) => {
    const last = l.thread[l.thread.length - 1];
    const subject = last ? (last.subject.startsWith("Re:") ? last.subject : `Re: ${last.subject}`) : l.company;
    return { ...l, unread: false, lastAt: Date.now(), thread: [...l.thread, { from: "us", at: Date.now(), inbox: l.thread[0]?.inbox ?? "your inbox", subject, body }] };
  });
}

/** Marko's draft for the next reply, from what they said last. */
export function suggestReply(l: Lead, rules: Rules) {
  const said = [...l.thread].reverse().find((m) => m.from === "them")?.body.toLowerCase() ?? "";
  const name = l.owner?.split(" ")[0] ?? "there";
  if (/cost|price|how much|pricing/.test(said))
    return `Hi ${name},\n\nGood question. It depends on how many locations and keywords you want covered, but most ${l.vars.keyword} businesses start on a monthly plan that pays for itself with one or two extra jobs.\n\nThe quickest way to give you a real number is a 15-minute walkthrough of the audit: ${rules.bookingUrl}\n\nWhat day works for you?`;
  if (/already|agency|someone|not interested|no thanks/.test(said))
    return `Totally understood, ${name}. If it's useful, keep the audit link and compare it with what you're getting now. Happy to help if anything changes.`;
  return `Hi ${name},\n\nGreat to hear. Here's my calendar, pick any 15-minute slot that suits you: ${rules.bookingUrl}\n\nI'll walk you through the map and the first three fixes.`;
}

// ---------- Sample conversations (mock) ----------

function sampleLeads(c: Connection): Lead[] {
  const m = searchMarket(defaultSpec);
  const qs = specToQuery(defaultSpec);
  const picks = m.prospects.filter((p) => p.contact.email && p.contact.owner).slice(0, 5);
  const camp = c.campaigns.find((x) => x.usesAuditUrl) ?? c.campaigns[0];
  const replies: { status: LeadStatus; hoursAgo: number; them?: string; us?: string; step: number; views?: number }[] = [
    { status: "replied", hoursAgo: 1, step: 1, views: 3, them: "Hi Alex,\n\nThis is interesting. We've been stuck around the middle of the map for a year and I didn't know {{top_competitor}} was that far ahead. What does something like this cost?\n\nThanks" },
    { status: "booked", hoursAgo: 20, step: 1, views: 2, them: "Sure, I can do Thursday afternoon.", us: "Perfect. Booked you for Thursday at 2pm, invite's on its way. I'll walk you through the map and the first three fixes." },
    { status: "replied", hoursAgo: 5, step: 2, them: "Who is this? How did you get my email?" },
    { status: "not_interested", hoursAgo: 30, step: 1, them: "We already have a marketing company, thanks." },
    { status: "sent", hoursAgo: 52, step: 2, views: 2 },
  ];
  return picks.flatMap((p, i) => {
    const r = replies[i];
    const path = `/prospects/${p.id}${qs}`;
    const base = leadFrom(p, opportunity(p, m), m, path);
    if (!base || !r) return [];
    const start = Date.now() - (r.hoursAgo + 96) * hr;
    let l: Lead = { ...base, campaignId: camp.id, campaignName: camp.name, status: "queued", step: 0, addedAt: start, lastAt: start, unread: false, thread: [] };
    for (let s = 1; s <= r.step; s++) l = sendStep(l, c, s, start + (s - 1) * 72 * hr);
    const at = Date.now() - r.hoursAgo * hr;
    if (r.them) l = { ...l, lastAt: at, unread: r.status === "replied", thread: [...l.thread, { from: "them", at, inbox: l.thread[0].inbox, subject: `Re: ${l.thread[0].subject}`, body: render(r.them, l.vars) }] };
    if (r.us) l = { ...l, lastAt: at + hr, thread: [...l.thread, { from: "us", at: at + hr, inbox: l.thread[0].inbox, subject: `Re: ${l.thread[0].subject}`, body: r.us }] };
    for (let v = 0; v < (r.views ?? 0); v++) recordView(ensureShare(path, p.name).token, { at: at - (v + 1) * 2 * hr, device: v % 2 ? "iPhone" : "Desktop", seconds: 70 + v * 55, sections: ["Map", "Competitors", "Quick fixes"].slice(0, v + 1) });
    return [{ ...l, status: r.status }];
  });
}

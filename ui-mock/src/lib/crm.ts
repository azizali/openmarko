// One store for contacts and everything sent to them: the timeline of every
// email, text and call, call tasks, campaigns, workflows and the sending
// setup. The Inbox is the timeline's channel events grouped by person.
// Every change to a contact is also an event (tag added, stage changed, joined
// a list, replied…) that starts the workflows listening for it.
// Mock: localStorage, with timers standing in for replies and webhooks.

import { useSyncExternalStore } from "react";
import { fillFields, mergeFields, segments, seedContacts, type CallResult, type CallTask, type Channel, type Contact, type Event, type SegmentId, type Stage } from "../data/contacts";
import { dateFields, eventMeta, recipes, seedWorkflows, seedCampaigns, seedChannels, type Audience, type Workflow, type Campaign, type Channels, type Cond, type EventId, type PhoneNumber, type Send, type Step, type StepKind, type When } from "../data/messaging";
import { dnsRecords, type EmailProviderId, type PhoneProviderId } from "../data/providers";
import { brandFacts } from "../data/brand";
import { isOn } from "./features";

type State = { v: number; contacts: Contact[]; events: Event[]; tasks: CallTask[]; campaigns: Campaign[]; workflows: Workflow[]; channels: Channels };
const V = 3; // bump when the saved shape changes

const KEY = "gw-crm";
const day = 86_400_000;
const fresh = (): State => ({ v: V, ...seedContacts(), campaigns: seedCampaigns(), workflows: seedWorkflows(), channels: seedChannels() });
const load = (): State => { try { const s = JSON.parse(localStorage.getItem(KEY) ?? "null"); return s?.v === V ? s : fresh(); } catch { return fresh(); } };
let state: State = load();
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  listeners.forEach((l) => l());
};
let seq = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

export const useCrm = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => state, () => state);
export type CrmState = State;

// ---------- Reading ----------

export const contactOf = (s: State, id: string) => s.contacts.find((c) => c.id === id);
export const eventsOf = (s: State, id: string) => s.events.filter((e) => e.contactId === id);
export const inSegment = (s: State, seg: SegmentId, now = Date.now()) => { const t = segments.find((x) => x.id === seg)!.test; return s.contacts.filter((c) => t(c, now)); };
export const isTalk = (e: Event) => e.kind === "email" || e.kind === "sms" || e.kind === "call";
export const lastTouch = (s: State, id: string) => { const ev = s.events.filter((e) => e.contactId === id && isTalk(e)); return ev[ev.length - 1]; };
const isStop = (e: Event) => e.kind === "sms" && e.dir === "in" && /^\s*(stop|unsubscribe|cancel|end|quit)\s*$/i.test(e.body);

/** Their turn ended the conversation: they wrote last, or we missed their call. */
export const needsReply = (last: Event | undefined) => !!last && last.dir === "in" && !isStop(last) && (last.kind !== "call" || last.call?.result === "missed");

export type Conversation = { contact: Contact; last: Event; unread: number; waiting: boolean; channels: Channel[] };
export function conversations(s: State): Conversation[] {
  const by = new Map<string, Event[]>();
  s.events.forEach((e) => { if (isTalk(e)) by.set(e.contactId, [...(by.get(e.contactId) ?? []), e]); });
  return [...by.entries()].flatMap(([id, evs]) => {
    const contact = contactOf(s, id);
    if (!contact) return [];
    const last = evs[evs.length - 1];
    return [{ contact, last, unread: evs.filter((e) => e.dir === "in" && e.read === false).length, waiting: needsReply(last), channels: [...new Set(evs.map((e) => e.kind as Channel))] }];
  }).sort((a, b) => b.last.at - a.last.at);
}
export const unreadCount = (s: State) => s.events.filter((e) => e.dir === "in" && e.read === false).length;
export const openTasks = (s: State) => s.tasks.filter((t) => !t.done).sort((a, b) => a.due - b.due);

/** Why nothing can go out on a channel yet (setup), or null when it can. */
export function notReady(s: State, ch: Channel): string | null {
  if ((ch === "email" || ch === "sms") && !isOn(ch)) return ch === "email" ? "Email is turned off in Settings → Features" : "Texting is turned off in Settings → Features";
  if (ch === "email") return !s.channels.email.provider ? "Email sending isn't set up yet" : !s.channels.email.verified ? "Your sending domain isn't verified yet" : null;
  if (ch === "sms") return !s.channels.sms.provider ? "Texting isn't set up yet" : s.channels.sms.campaign !== "approved" ? "Texting starts once carrier registration is approved" : !s.channels.sms.numbers.some((n) => n.status === "active") ? "No number is active yet" : null;
  return null;
}

/** Why a contact can't get something on a channel, or null when they can. */
export function blockedOn(c: Contact, ch: Channel): string | null {
  if (ch === "email") return !c.email ? "No email address" : !c.consent.email ? "Unsubscribed from email" : null;
  if (ch === "sms") return !c.phone || !c.mobile ? "No mobile number" : !c.consent.sms ? "Hasn't agreed to texts" : null;
  return !c.phone ? "No phone number" : null;
}

// ---------- Contacts ----------

const addEvents = (s: State, evs: Omit<Event, "id">[]): Event[] => [...s.events, ...evs.map((e) => ({ id: uid("e"), ...e }))];
const patch = (ids: string[], fn: (c: Contact) => Contact) => state.contacts.map((c) => (ids.includes(c.id) ? fn(c) : c));

export type Started = { name: string; n: number };
export const startedText = (st: Started[]) => (st.length ? ` Started ${st.map((x) => `${x.name} for ${x.n}`).join(", ")}.` : "");

export function setStage(ids: string[], stage: Stage): Started[] {
  const now = Date.now();
  const moved = state.contacts.filter((c) => ids.includes(c.id) && c.stage !== stage);
  const extra: Omit<Event, "id">[] = moved.map((c) => (stage === "booked" ? { contactId: c.id, at: now, kind: "booking", body: `Booked at ${c.location}${sourcesAd(c) ? ". Sent to " + sourcesAd(c) + " as a result" : ""}`, by: "You" } : { contactId: c.id, at: now, kind: "stage", body: `Moved to ${stageLabel(stage)}`, by: "You" }));
  const m = moved.map((c) => c.id);
  return tracked(m, () => {
    set({ ...state, contacts: patch(m, (c) => ({ ...c, stage, nextAppt: stage === "booked" ? c.nextAppt ?? now + 3 * day : c.nextAppt })), events: addEvents(state, extra) });
    return [...fire({ event: "stage_changed", stage }, m), ...(stage === "booked" ? fire({ event: "appt_booked" }, m) : [])];
  });
}
const stageLabel = (s: Stage) => ({ new: "New lead", contacted: "Contacted", booked: "Booked", patient: "Patient", lost: "Lost" })[s];
const sourcesAd = (c: Contact) => (c.source === "meta_ad" ? "Meta" : c.source === "google_ad" ? "Google Ads" : null);

export function addTag(ids: string[], tag: string, depth = 0): Started[] {
  const m = state.contacts.filter((c) => ids.includes(c.id) && !c.tags.includes(tag)).map((c) => c.id);
  return tracked(m, () => { set({ ...state, contacts: patch(m, (c) => ({ ...c, tags: [...c.tags, tag] })) }); return fire({ event: "tag_added", tag }, m, depth); });
}
export function removeTag(ids: string[], tag: string, depth = 0): Started[] {
  const m = state.contacts.filter((c) => ids.includes(c.id) && c.tags.includes(tag)).map((c) => c.id);
  return tracked(m, () => { set({ ...state, contacts: patch(m, (c) => ({ ...c, tags: c.tags.filter((t) => t !== tag) })) }); return fire({ event: "tag_removed", tag }, m, depth); });
}
export const setConsent = (id: string, ch: "email" | "sms", on: boolean) =>
  set({ ...state, contacts: patch([id], (c) => ({ ...c, consent: { ...c.consent, [ch]: on, how: on ? "Turned on by you, with their OK" : c.consent.how } })), events: addEvents(state, [{ contactId: id, at: Date.now(), kind: "note", by: "You", body: `${on ? "Turned on" : "Turned off"} ${ch === "sms" ? "texts" : "email"}` }]) });
export const addNote = (id: string, body: string) => set({ ...state, events: addEvents(state, [{ contactId: id, at: Date.now(), kind: "note", by: "You", body }]) });
export const removeContacts = (ids: string[]) => set({ ...state, contacts: state.contacts.filter((c) => !ids.includes(c.id)), events: state.events.filter((e) => !ids.includes(e.contactId)), tasks: state.tasks.filter((t) => !ids.includes(t.contactId)) });

export type NewContact = Pick<Contact, "name" | "email" | "phone" | "source" | "location" | "tags"> & { smsOk: boolean; emailOk: boolean };
/** Add someone by hand. It fires "A contact is added", the same as a lead from an ad would. */
export function addContact(x: NewContact) {
  const now = Date.now();
  const c: Contact = {
    id: uid("ct"), name: x.name.trim(), email: x.email?.trim() || null, phone: x.phone?.trim() || null, mobile: !!x.phone, stage: "new", source: x.source, sourceDetail: "Added by you",
    location: x.location, tags: x.tags, value: x.tags.includes("Invisalign") ? 5200 : 1200, consent: { email: x.emailOk && !!x.email, sms: x.smsOk && !!x.phone, how: "Added by you, with their OK" }, createdAt: now, lastVisit: null, nextAppt: null, notes: "",
  };
  const started = tracked([c.id], () => { set({ ...state, contacts: [c, ...state.contacts] }); return fire({ event: "contact_created" }, [c.id]); });
  return { id: c.id, started };
}

// ---------- Triggers ----------

export type Happened = { event: EventId; tag?: string; stage?: Stage; list?: SegmentId; keyword?: string; workflow?: string; ended?: "finished" | "stopped"; campaign?: string };

const condOk = (c: Contact, k: Cond) => {
  const has = k.field === "tag" ? k.values.some((v) => c.tags.includes(v)) : k.field === "stage" ? k.values.includes(c.stage) : k.field === "source" ? k.values.includes(c.source)
    : k.field === "location" ? k.values.includes(c.location) : k.field === "can_text" ? !blockedOn(c, "sms") : !blockedOn(c, "email");
  return k.op === "is" ? has : !has;
};
const word = (w: string) => new RegExp(`(^|\\W)${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\W|$)`, "i");
export const whenMatches = (w: When, h: Happened) =>
  w.event === h.event && (!w.tag || w.tag === h.tag) && (!w.stage || w.stage === h.stage) && (!w.list || w.list === h.list) &&
  (!w.keyword || word(w.keyword).test(h.keyword ?? "")) && (!w.workflow || w.workflow === h.workflow) &&
  (!w.ended || w.ended === "any" || w.ended === h.ended) && (!w.campaign || w.campaign === "any" || w.campaign === h.campaign);

/** Something happened to these contacts: start every workflow that's on and listening for it. */
export function fire(h: Happened, ids: string[], depth = 0): Started[] {
  if (!ids.length || depth > 3 || !isOn("workflows")) return []; // depth stops workflows that start each other from looping
  return state.workflows.flatMap((a) => {
    if (!a.on || !whenMatches(a.when, h)) return [];
    const who = state.contacts.filter((c) => ids.includes(c.id) && a.only.every((k) => condOk(c, k)));
    if (!who.length) return [];
    start(a, who, depth);
    return [{ name: a.name, n: who.length }];
  });
}

/** Run a change and, afterwards, fire "joins a list" / "leaves a list" for anyone whose lists changed. */
function tracked(ids: string[], change: () => Started[]): Started[] {
  const lists = () => { const now = Date.now(); return new Map(segments.filter((g) => g.id !== "all").map((g) => [g.id, new Set(state.contacts.filter((c) => ids.includes(c.id) && g.test(c, now)).map((c) => c.id))])); };
  const before = lists();
  const out = change();
  lists().forEach((after, list) => {
    const was = before.get(list)!;
    out.push(...fire({ event: "list_joined", list }, [...after].filter((x) => !was.has(x))), ...fire({ event: "list_left", list }, [...was].filter((x) => !after.has(x))));
  });
  return out;
}

/** Put people into a workflow: log it, and run the first step now if it's due within a few minutes. */
function start(a: Workflow, who: Contact[], depth: number) {
  set({
    ...state,
    workflows: state.workflows.map((x) => (x.id === a.id ? { ...x, stats: { ...x.stats, inNow: x.stats.inNow + who.length, started30: x.stats.started30 + who.length } } : x)),
    events: addEvents(state, who.map((c) => ({ contactId: c.id, at: Date.now(), kind: "note" as const, by: a.name, body: `Started ${a.name}` }))),
  });
  let waited = 0;
  const first = a.steps.find((s) => { if (s.kind !== "wait") return true; waited += s.wait!.n * { minutes: 1, hours: 60, days: 1440 }[s.wait!.unit]; return false; });
  if (!first || waited > 5) return;
  const ids = who.map((c) => c.id);
  setTimeout(() => {
    if (first.kind === "sms" || first.kind === "email") {
      const ok = state.contacts.filter((c) => ids.includes(c.id) && !blockedOn(c, first.kind as Channel) && !notReady(state, first.kind as Channel));
      set({ ...state, contacts: patch(ok.map((c) => c.id), (k) => (k.stage === "new" ? { ...k, stage: "contacted" } : k)), events: addEvents(state, ok.map((c) => ({ contactId: c.id, at: Date.now(), kind: first.kind as Channel, dir: "out" as const, by: a.name, subject: first.subject && fillFields(first.subject, c), body: fillFields(first.body ?? "", c) }))) });
    } else if (first.kind === "call") set({ ...state, tasks: [...state.tasks, ...ids.map((id) => ({ id: uid("t"), contactId: id, due: Date.now() + 5 * 60_000, reason: `${a.name}: first step`, from: a.name, script: first.body ?? "" }))] });
    else if (first.kind === "tag" && first.tag) addTag(ids, first.tag, depth + 1);
    else if (first.kind === "untag" && first.tag) removeTag(ids, first.tag, depth + 1);
    else if (first.kind === "stage" && first.stage) setStage(ids, first.stage);
    else if (first.kind === "start") { const b = state.workflows.find((x) => x.id === first.workflow); if (b && depth < 3) start(b, state.contacts.filter((c) => ids.includes(c.id)), depth + 1); }
  }, 1500);
}

/** "When tag “Invisalign” is added", for lists and the editor. */
export function describeWhen(s: State, w: When) {
  const auto = (id?: string) => s.workflows.find((a) => a.id === id)?.name ?? "another workflow";
  const camp = (id?: string) => (!id || id === "any" ? "any campaign" : `“${s.campaigns.find((c) => c.id === id)?.name ?? "a campaign"}”`);
  const list = (id?: SegmentId) => `“${segments.find((g) => g.id === id)?.label ?? "a list"}”`;
  switch (w.event) {
    case "tag_added": return `Tag “${w.tag ?? "…"}” is added`;
    case "tag_removed": return `Tag “${w.tag ?? "…"}” is removed`;
    case "stage_changed": return `Stage changes to ${w.stage ? stageLabel(w.stage) : "…"}`;
    case "list_joined": return `They join ${list(w.list)}`;
    case "list_left": return `They leave ${list(w.list)}`;
    case "reply_received": return w.keyword ? `They reply “${w.keyword}”` : "They reply";
    case "date": return w.date ? (w.date.days ? `${w.date.days} days ${w.date.dir} their ${dateFields[w.date.field]}` : `On their ${dateFields[w.date.field]}`) : "A date comes around";
    case "workflow_finished": return `${auto(w.workflow)} ${w.ended === "finished" ? "finishes every step" : w.ended === "stopped" ? "stops early" : "ends"} for them`;
    case "campaign_received": return `They get ${camp(w.campaign)}`;
    case "campaign_clicked": return `They click ${camp(w.campaign)}`;
    case "campaign_replied": return `They reply to ${camp(w.campaign)}`;
    default: return eventMeta[w.event].label;
  }
}

/** Pull patients from the booking system (mock: a handful of new records). */
export function importFromBooking() {
  const now = Date.now();
  const names = ["Iris Coleman", "Victor Alvarez", "Joy Hammond", "Pete Lindqvist", "Rosa Delgado", "Owen Fitch"];
  const added: Contact[] = names.filter((nm) => !state.contacts.some((c) => c.name === nm)).map((name, i) => ({
    id: uid("ct"), name, email: `${name.toLowerCase().replace(" ", ".")}@gmail.com`, phone: `(512) 555-${3100 + i * 13}`, mobile: true, stage: "patient", source: "booking", sourceDetail: "NexHealth sync",
    location: i % 2 ? "Mueller" : "South Congress", tags: [], value: 1200, consent: { email: true, sms: i % 3 !== 0, how: "Patient intake form" }, createdAt: now, lastVisit: now - (200 + i * 40) * day, nextAppt: null, notes: "",
  }));
  set({ ...state, contacts: [...added, ...state.contacts] });
  return added.length;
}

// ---------- Inbox ----------

export const markRead = (id: string) => { if (state.events.some((e) => e.contactId === id && e.read === false)) set({ ...state, events: state.events.map((e) => (e.contactId === id && e.read === false ? { ...e, read: true } : e)) }); };

export function sendMessage(id: string, ch: "email" | "sms", body: string, subject?: string) {
  const c = contactOf(state, id);
  if (!c) return;
  const tail = ch === "sms" && !state.events.some((e) => e.contactId === id && e.kind === "sms" && e.dir === "out") ? ` ${state.channels.sms.optOutLine}` : "";
  set({
    ...state,
    contacts: patch([id], (k) => (k.stage === "new" ? { ...k, stage: "contacted" } : k)),
    events: addEvents({ ...state, events: state.events.map((e) => (e.contactId === id && e.read === false ? { ...e, read: true } : e)) }, [{ contactId: id, at: Date.now(), kind: ch, dir: "out", by: "You", subject, body: body + tail }]),
  });
}

export function logCall(id: string, result: CallResult, note: string, seconds = 0) {
  const label = { answered: "Talked", voicemail: "Left a voicemail", no_answer: "No answer", missed: "Missed" }[result];
  set({
    ...state,
    contacts: patch([id], (k) => (k.stage === "new" ? { ...k, stage: "contacted" } : k)),
    tasks: state.tasks.map((t) => (t.contactId === id && !t.done ? { ...t, done: Date.now() } : t)),
    events: addEvents({ ...state, events: state.events.map((e) => (e.contactId === id && e.read === false ? { ...e, read: true } : e)) }, [{ contactId: id, at: Date.now(), kind: "call", dir: "out", by: "You", body: note.trim() ? `${label}. ${note.trim()}` : label, call: { result, seconds } }]),
  });
}
export const skipTask = (id: string) => set({ ...state, tasks: state.tasks.map((t) => (t.id === id ? { ...t, done: Date.now() } : t)) });

/** Marko's draft, from what they said last. Real build: Claude with the brand voice, their record and the schedule. */
export function suggestReply(c: Contact, last: Event | undefined) {
  const first = c.name.split(" ")[0];
  const said = (last?.dir === "in" ? last.body : "").toLowerCase();
  const book = `${brandFacts.website}/book`;
  if (last?.kind === "call" && last.call?.result === "missed") return `Hi ${first}, sorry we missed your call! This is ${brandFacts.name}. How can we help? You can also book here: ${book}`;
  if (/crown|broke|pain|hurt|today|emergency|swollen/.test(said)) return `Hi ${first}, sorry to hear that! We keep same-day emergency slots every weekday. Can you come in at 3:15 today at ${c.location}? Reply YES and we'll hold it for you.`;
  if (/delta|cigna|insurance|cost|price|how much/.test(said)) return `Hi ${first}, yes, we take Delta Dental and Cigna, and we'll check your coverage first. Want a time this week? ${book}`;
  if (/saturday|sat\b|morning|monday|tuesday|wednesday|thursday|friday/.test(said)) return `Hi ${first}, Saturday the 8th at 9:00am is open at ${c.location}. Want it? Reply YES and you're booked.`;
  if (/kid|son|daughter|child/.test(said)) return `Hi ${first},\n\nWe'd love to see him! We see kids from their first tooth, and first visits are short and fun: a look around, a ride in the chair and a quick check.\n\nSaturday mornings are popular with families. Pick a time here: ${book}`;
  if (/review|done|thanks|thank you/.test(said)) return `Thank you so much, ${first}! See you in 6 months.`;
  return `Hi ${first}, thanks for getting in touch with ${brandFacts.name}! What can we help with? You can also book here: ${book}`;
}

// ---------- Campaigns ----------

export const audienceLabel = (a: Audience) => ("segment" in a ? segments.find((s) => s.id === a.segment)!.label : a.label);
export function audienceOf(s: State, cp: Pick<Campaign, "audience" | "channel">) {
  const all = "segment" in cp.audience ? inSegment(s, cp.audience.segment) : s.contacts.filter((c) => (cp.audience as { ids: string[] }).ids.includes(c.id));
  const setup = notReady(s, cp.channel);
  if (setup) return { all, will: [] as Contact[], skipped: [{ why: setup, n: all.length }] };
  const skipped = new Map<string, number>();
  const will = all.filter((c) => { const why = blockedOn(c, cp.channel); if (why) skipped.set(why, (skipped.get(why) ?? 0) + 1); return !why; });
  return { all, will, skipped: [...skipped.entries()].map(([why, n]) => ({ why, n })) };
}

export function newCampaign(channel: Send, audience: Audience = { segment: "recall" }) {
  const c: Campaign = { id: uid("cp_"), name: "", channel, audience, subject: "", body: "", status: "draft", sendAt: null, sentAt: null, stats: null, createdAt: Date.now() };
  set({ ...state, campaigns: [c, ...state.campaigns] });
  return c.id;
}
export const updateCampaign = (id: string, p: Partial<Campaign>) => set({ ...state, campaigns: state.campaigns.map((c) => (c.id === id ? { ...c, ...p } : c)) });
export const deleteCampaign = (id: string) => set({ ...state, campaigns: state.campaigns.filter((c) => c.id !== id) });
export function duplicateCampaign(id: string) {
  const c = state.campaigns.find((x) => x.id === id);
  if (!c) return null;
  const copy: Campaign = { ...c, id: uid("cp_"), name: `${c.name} (copy)`, status: "draft", sendAt: null, sentAt: null, stats: null, createdAt: Date.now() };
  set({ ...state, campaigns: [copy, ...state.campaigns] });
  return copy.id;
}

/** Send now, or schedule. Sending writes the message onto each person's timeline; results fill in as webhooks would. */
export function sendCampaign(id: string, at: number | null) {
  const cp = state.campaigns.find((c) => c.id === id);
  if (!cp) return;
  if (at && at > Date.now() + 60_000) return updateCampaign(id, { status: "scheduled", sendAt: at });
  const { will } = audienceOf(state, cp);
  const now = Date.now();
  const tail = cp.channel === "sms" ? ` ${state.channels.sms.optOutLine}` : "";
  updateCampaign(id, { status: "sending", sendAt: null });
  setTimeout(() => {
    const n = will.length;
    const k = (r: number) => Math.round(n * r);
    const stats = cp.channel === "email" ? { sent: n, delivered: k(0.97), opened: k(0.48), clicked: k(0.08), replied: k(0.03), booked: k(0.06), optedOut: k(0.01) } : { sent: n, delivered: k(0.98), replied: k(0.2), booked: k(0.12), optedOut: k(0.015) };
    set({
      ...state,
      campaigns: state.campaigns.map((c) => (c.id === id ? { ...c, status: "sent", sentAt: now, stats } : c)),
      events: addEvents(state, will.map((c) => ({ contactId: c.id, at: now, kind: cp.channel, dir: "out" as const, by: cp.name || "Campaign", subject: cp.channel === "email" ? fillFields(cp.subject, c) : undefined, body: fillFields(cp.body, c) + tail }))),
    });
    const ids = will.map((c) => c.id);
    fire({ event: "campaign_received", campaign: id }, ids);
    // Clicks arrive as the provider's click webhooks would.
    setTimeout(() => { const clicked = ids.slice(2, 2 + Math.max(1, Math.round(n * 0.08))); fire({ event: "campaign_clicked", campaign: id }, clicked); fire({ event: "link_clicked" }, clicked); }, 3000);
    // A couple of replies come back, the way the provider's inbound webhook would deliver them.
    setTimeout(() => {
      const repliers = will.slice(0, Math.min(2, will.length));
      const lines = cp.channel === "sms" ? ["Yes please! Any time Tuesday after 4?", "Can I bring my daughter too?"] : ["Thanks for the reminder. Do you have anything the week of the 17th?", "Is my insurance still on file?"];
      set({ ...state, events: addEvents(state, repliers.map((c, i) => ({ contactId: c.id, at: Date.now(), kind: cp.channel, dir: "in" as const, subject: cp.channel === "email" ? `Re: ${fillFields(cp.subject, c)}` : undefined, body: lines[i], read: false }))) });
      repliers.forEach((c, i) => { fire({ event: "campaign_replied", campaign: id }, [c.id]); fire({ event: "reply_received", keyword: lines[i] }, [c.id]); });
    }, 5000);
  }, 1500);
}

// ---------- Message checks ----------

export type Flag = { level: "block" | "warn" | "info"; text: string };
const gsm = /^[\x20-\x7E\n£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉÄÖÑÜ§¿äöñüà€]*$/;
export const smsParts = (text: string) => { const uni = !gsm.test(text); const len = [...text].length; const one = uni ? 70 : 160; const multi = uni ? 67 : 153; return { len, parts: len <= one ? 1 : Math.ceil(len / multi), uni }; };

/** Length is measured with typical values in the fields, not the {{tokens}}. */
export const withExamples = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (m, k: string) => mergeFields.find((x) => x.key === k)?.example ?? m);

/** Rules every message is checked against before it can go out. */
export function messageChecks(ch: Send, subject: string, body: string, optOut: string): Flag[] {
  const f: Flag[] = [];
  const filled = withExamples(body);
  const all = `${subject} ${body}`;
  if (!body.trim()) return [{ level: "block", text: "Write the message first." }];
  if (ch === "email" && !subject.trim()) f.push({ level: "block", text: "Add a subject line." });
  if (/painless|guarantee/i.test(all)) f.push({ level: "block", text: "Breaks a brand rule: no promises of results or “painless” claims." });
  if (/\{\{(?!first_name|business|location|booking_link|review_link|appt_time|offer)\w+\}\}/.test(all)) f.push({ level: "block", text: "Uses a field that doesn't exist. Pick one from Insert field." });
  if (ch === "sms") {
    const { parts, uni } = smsParts(`${filled} ${optOut}`);
    if (parts > 1) f.push({ level: "warn", text: `${parts} text segments${uni ? " (an emoji or special character halves the length)" : ""}. Each costs about $0.008; under 160 characters is one.` });
    if (/bit\.ly|tinyurl|t\.co\//i.test(body)) f.push({ level: "block", text: "Public link shorteners get texts filtered by carriers. Use your own domain." });
    if (/root canal|crown|extraction|implant|gum disease|cavit/i.test(body)) f.push({ level: "warn", text: "Names a treatment. Texts show on lock screens; keep health details out and let them call or log in." });
    f.push({ level: "info", text: `“${optOut}” is added to the first text anyone gets from you, and STOP replies are honored automatically.` });
  } else {
    if (subject.length > 60) f.push({ level: "warn", text: `Subject is ${subject.length} characters; phones cut it off around 40–60.` });
    if (/!!|FREE|\$\$\$|ACT NOW/.test(all)) f.push({ level: "warn", text: "Shouting (FREE, !!, $$$) is a common spam signal." });
    f.push({ level: "info", text: "Your address and an unsubscribe link are added to the footer." });
  }
  return f;
}

/** Marko's first draft for a campaign. Real build: Claude with the brand voice and the offer. */
export function draftCampaign(ch: Send, seg: SegmentId | null): { name: string; subject: string; body: string } {
  if (seg === "lapsed") return { name: "We miss you", subject: "It's been a while, {{first_name}}", body: ch === "sms" ? "Hi {{first_name}}, it's {{business}}. It's been a while! Book a cleaning in a minute: {{booking_link}}" : "Hi {{first_name}},\n\nIt's been a while since we've seen you at {{business}}. Whatever kept you away, we'd love to see you again, no lecture included.\n\nBook in a minute: {{booking_link}}" };
  if (seg === "invisalign") return { name: "Invisalign consult", subject: "Your free Invisalign consult", body: ch === "sms" ? "Hi {{first_name}}, {{offer}}. Want a consult slot this week? {{booking_link}}" : "Hi {{first_name}},\n\nConsults are free through November: a 3D scan, a preview of your new smile, and a straight answer on cost.\n\nPick a time: {{booking_link}}" };
  if (seg === "no_show") return { name: "Let's reschedule", subject: "Let's find you a new time", body: "Hi {{first_name}}, we missed you at your last appointment. No worries! Pick a new time here: {{booking_link}}" };
  return { name: "Benefits reset Dec 31", subject: "Your dental benefits reset on Dec 31", body: ch === "sms" ? "Hi {{first_name}}, your dental benefits reset Dec 31. We have openings at {{location}}, Saturdays too: {{booking_link}}" : "Hi {{first_name}},\n\nMost dental plans cover two cleanings a year, and whatever you don't use by December 31 is gone.\n\nWe still have openings in November and December at {{location}}, including Saturdays: {{booking_link}}\n\nSee you soon,\nThe {{business}} team" };
}

// ---------- Workflows ----------

export function addWorkflow(recipeId: string | null) {
  const r = recipes.find((x) => x.id === recipeId);
  const a: Workflow = r
    ? { id: uid("au_"), name: r.name, on: false, when: { ...r.when }, only: r.only ?? [], steps: r.steps().map((s) => ({ ...s, id: uid("st"), stats: undefined })), exits: r.exits, stats: { inNow: 0, started30: 0, booked30: 0 }, recipe: r.id }
    : { id: uid("au_"), name: "New workflow", on: false, when: { event: "tag_added", tag: "VIP" }, only: [], steps: [], exits: ["replied", "booked", "opted_out"], stats: { inNow: 0, started30: 0, booked30: 0 } };
  set({ ...state, workflows: [...state.workflows, a] });
  return a.id;
}
export const updateWorkflow = (id: string, p: Partial<Workflow>) => set({ ...state, workflows: state.workflows.map((a) => (a.id === id ? { ...a, ...p } : a)) });
export const deleteWorkflow = (id: string) => set({ ...state, workflows: state.workflows.filter((a) => a.id !== id) });
const steps = (id: string, fn: (s: Step[]) => Step[]) => { const a = state.workflows.find((x) => x.id === id); if (a) updateWorkflow(id, { steps: fn(a.steps) }); };
export function addStep(id: string, at: number, kind: StepKind) {
  const blank: Step = { id: uid("st"), kind, ...(kind === "wait" ? { wait: { n: 1, unit: "days" as const } } : kind === "stage" ? { stage: "contacted" as Stage } : kind === "tag" || kind === "untag" ? { tag: "VIP" } : kind === "start" ? { workflow: state.workflows.find((a) => a.id !== id)?.id } : { body: "", subject: kind === "email" ? "" : undefined, onlyIf: at > 0 ? ("no_reply" as const) : undefined }) };
  steps(id, (s) => [...s.slice(0, at), blank, ...s.slice(at)]);
  return blank.id;
}
export const updateStep = (id: string, stepId: string, p: Partial<Step>) => steps(id, (s) => s.map((x) => (x.id === stepId ? { ...x, ...p } : x)));
export const removeStep = (id: string, stepId: string) => steps(id, (s) => s.filter((x) => x.id !== stepId));
export const moveStep = (id: string, stepId: string, by: -1 | 1) => steps(id, (s) => { const i = s.findIndex((x) => x.id === stepId); const j = i + by; if (j < 0 || j >= s.length) return s; const c = [...s]; [c[i], c[j]] = [c[j], c[i]]; return c; });

/** Put people into a workflow by hand (from Contacts). Returns how many could start. */
export function enroll(ids: string[], workflowId: string) {
  const a = state.workflows.find((x) => x.id === workflowId);
  if (!a) return 0;
  const first = a.steps.find((s) => s.kind === "sms" || s.kind === "email");
  const ok = state.contacts.filter((c) => ids.includes(c.id) && (!first || !blockedOn(c, first.kind as Channel)));
  if (ok.length) start(a, ok, 0);
  return ok.length;
}

// ---------- Sending setup ----------

export function connectEmail(provider: EmailProviderId, domain: string, fromName: string, fromLocal: string, region?: string) {
  setChannels("email", { provider, region, domain, verified: false, fromName, fromAddress: `${fromLocal}@${domain}`, records: dnsRecords(provider, domain, region) });
}
/** Look the records up. Mock: everything is found on the second look, DMARC included. */
export function checkDns(onDone: (missing: number) => void) {
  setTimeout(() => {
    const e = state.channels.email;
    const tries = e.records.some((r) => r.ok) ? 2 : 1;
    const records = e.records.map((r) => ({ ...r, ok: tries > 1 || !r.host.startsWith("_dmarc") }));
    setChannels("email", { records, verified: true });
    onDone(records.filter((r) => !r.ok).length);
  }, 1300);
}
export const disconnectEmail = () => setChannels("email", { provider: null, verified: false, records: [] });

export const connectPhone = (provider: PhoneProviderId) => setChannels("sms", { provider, numbers: [], brand: "none", campaign: "none" });
/** New numbers are live at once; hosted texting and ports take days (mock: a few seconds). */
export function addNumbers(nums: PhoneNumber[]) {
  setChannels("sms", { numbers: [...state.channels.sms.numbers.filter((n) => !nums.some((x) => x.location === n.location)), ...nums] });
  const slow = nums.filter((n) => n.status === "pending");
  if (slow.length) setTimeout(() => setChannels("sms", { numbers: state.channels.sms.numbers.map((n) => (slow.some((x) => x.number === n.number) ? { ...n, status: "active" } : n)) }), 8000);
}
/** File the brand and campaign with the carriers. Mock: brand in a few seconds, campaign a few more. */
export function registerTexting() {
  setChannels("sms", { brand: "pending", campaign: "pending" });
  setTimeout(() => setChannels("sms", { brand: "approved" }), 2500);
  setTimeout(() => setChannels("sms", { campaign: "approved" }), 7000);
}
export const disconnectPhone = () => setChannels("sms", { provider: null, numbers: [], brand: "none", campaign: "none" });

export const setChannels = <K extends keyof Channels>(k: K, p: Partial<Channels[K]>) => set({ ...state, channels: { ...state.channels, [k]: { ...state.channels[k], ...p } } });

/** Back to the sample data. */
export const resetCrm = () => set(fresh());

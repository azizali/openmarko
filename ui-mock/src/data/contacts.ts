// Contacts are the CRM: one record per person who has called, filled a form,
// booked or visited, with every email, text, call and visit on their timeline.
// The pipeline is a view of the same records by stage, not a second database.
// Leads from ads arrive with their source, and a booking is what gets reported
// back to Meta and Google as the result.
//
// Real build: contacts, events and call_tasks tables per Organization. People
// come in from the booking system (NexHealth / Open Dental sync), Meta lead
// forms and website forms (webhooks), and call tracking (CallRail webhooks).
// Patient records are health information: the sending providers need a BAA
// (Twilio and an email provider that signs one) before real patients go in.

import { brandFacts } from "./brand";

export type Channel = "email" | "sms" | "call";
export type Stage = "new" | "contacted" | "booked" | "patient" | "lost";
export type Source = "meta_ad" | "google_ad" | "website" | "call" | "gbp" | "referral" | "booking";

export const channelMeta: Record<Channel, { label: string; verb: string }> = {
  email: { label: "Email", verb: "Email" },
  sms: { label: "Text", verb: "Text" },
  call: { label: "Call", verb: "Call" },
};

export const stages: { id: Stage; label: string; tone: "neutral" | "info" | "accent" | "good" | "bad"; hint: string }[] = [
  { id: "new", label: "New lead", tone: "accent", hint: "Came in, nobody has talked to them yet" },
  { id: "contacted", label: "Contacted", tone: "info", hint: "We've reached out or they've replied" },
  { id: "booked", label: "Booked", tone: "good", hint: "Has an appointment. Counted as the ad result" },
  { id: "patient", label: "Patient", tone: "neutral", hint: "Has visited" },
  { id: "lost", label: "Lost", tone: "bad", hint: "Not coming, or asked us to stop" },
];
export const stageOf = (id: Stage) => stages.find((s) => s.id === id)!;

export const sources: Record<Source, { label: string; ad?: boolean }> = {
  meta_ad: { label: "Meta ad", ad: true },
  google_ad: { label: "Google ad", ad: true },
  website: { label: "Website form" },
  call: { label: "Phone call" },
  gbp: { label: "Google Business Profile" },
  referral: { label: "Referral" },
  booking: { label: "Booking system" },
};

export type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  mobile: boolean;
  stage: Stage;
  source: Source;
  sourceDetail: string;
  location: string;
  tags: string[];
  value: number; // estimated first-year value
  consent: { email: boolean; sms: boolean; how: string };
  createdAt: number;
  lastVisit: number | null;
  nextAppt: number | null;
  notes: string;
};

export type CallResult = "answered" | "voicemail" | "no_answer" | "missed";
export type Event = {
  id: string;
  contactId: string;
  at: number;
  kind: Channel | "note" | "stage" | "form" | "booking" | "visit";
  dir?: "in" | "out";
  subject?: string;
  body: string;
  by?: string; // "You", "Marko", or the campaign / automation that sent it
  call?: { result: CallResult; seconds: number };
  read?: boolean;
};

export type CallTask = { id: string; contactId: string; due: number; reason: string; script: string; from: string; done?: number };

// ---------- Lists (saved filters) ----------

const day = 86_400_000;
export type SegmentId = "all" | "new" | "ad_leads" | "booked_week" | "recall" | "no_show" | "invisalign" | "review_ask" | "lapsed";
export const segments: { id: SegmentId; label: string; hint: string; test: (c: Contact, now: number) => boolean }[] = [
  { id: "all", label: "Everyone", hint: "", test: () => true },
  { id: "new", label: "New leads, not contacted", hint: "Call or text them first", test: (c) => c.stage === "new" },
  { id: "ad_leads", label: "Ad leads, last 30 days", hint: "", test: (c, now) => !!sources[c.source].ad && now - c.createdAt < 30 * day },
  { id: "booked_week", label: "Appointments this week", hint: "", test: (c, now) => !!c.nextAppt && c.nextAppt - now < 7 * day && c.nextAppt > now },
  { id: "recall", label: "Due for a cleaning", hint: "Last visit 6+ months ago, nothing booked", test: (c, now) => c.stage === "patient" && !c.nextAppt && !!c.lastVisit && now - c.lastVisit > 180 * day && now - c.lastVisit < 540 * day },
  { id: "lapsed", label: "Haven't been in 18+ months", hint: "", test: (c, now) => c.stage === "patient" && !c.nextAppt && !!c.lastVisit && now - c.lastVisit >= 540 * day },
  { id: "no_show", label: "No-shows", hint: "", test: (c) => c.tags.includes("No-show") },
  { id: "invisalign", label: "Asked about Invisalign", hint: "", test: (c) => c.tags.includes("Invisalign") },
  { id: "review_ask", label: "Visited, no review yet", hint: "Visited in the last 14 days", test: (c, now) => c.stage === "patient" && !!c.lastVisit && now - c.lastVisit < 14 * day && !c.tags.includes("Left a review") },
];
export const tagOptions = ["Invisalign", "Emergency", "Kids", "Insurance: Delta", "Insurance: Cigna", "No insurance", "No-show", "Left a review", "VIP"];

// ---------- Merge fields ----------

export const mergeFields: { key: string; label: string; example: string }[] = [
  { key: "first_name", label: "First name", example: "Maria" },
  { key: "business", label: "Business name", example: brandFacts.name },
  { key: "location", label: "Their location", example: "South Congress" },
  { key: "booking_link", label: "Booking link", example: `${brandFacts.website}/book` },
  { key: "review_link", label: "Google review link", example: "g.page/r/maple-main/review" },
  { key: "appt_time", label: "Appointment time", example: "Thu Nov 6, 2:30pm" },
  { key: "offer", label: "Current offer", example: brandFacts.offers[1] },
];
export const fillFields = (text: string, c: Pick<Contact, "name" | "location" | "nextAppt">) =>
  text.replace(/\{\{(\w+)\}\}/g, (m, k: string) => {
    if (k === "first_name") return c.name.split(" ")[0];
    if (k === "location") return c.location;
    if (k === "appt_time") return c.nextAppt ? new Date(c.nextAppt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "your appointment";
    return mergeFields.find((f) => f.key === k)?.example ?? m;
  });

// ---------- Seed (mock) ----------

const firsts = ["Maria", "James", "Priya", "Daniel", "Sofia", "Marcus", "Emily", "Luis", "Hannah", "Kevin", "Aisha", "Tom", "Grace", "Diego", "Olivia", "Sam", "Nina", "Chris", "Leah", "Andre", "Rachel", "Ben", "Mei", "Jordan", "Carmen", "Eli", "Tasha", "Noah", "Ana", "Ryan"];
const lasts = ["Garcia", "Nguyen", "Patel", "Brooks", "Reyes", "Kim", "Johnson", "Ortiz", "Walker", "Chen", "Hughes", "Lopez", "Bennett", "Shah", "Morales", "Foster", "Rivera", "Price", "Turner", "Diaz"];
const adDetail = { meta_ad: ["$129 new patient visit", "Free Invisalign consult", "4.7★ from 212 neighbors"], google_ad: ["Emergency dentist · Search", "Invisalign · Search", "Brand · Search"] };

function rng(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function seedContacts(now = Date.now()): { contacts: Contact[]; events: Event[]; tasks: CallTask[] } {
  const r = rng(42);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const contacts: Contact[] = [];
  const events: Event[] = [];
  let n = 0;
  // Nothing in the seed happens in the future.
  const ev = (e: Omit<Event, "id">) => events.push({ id: `e${n++}`, ...e, at: Math.min(e.at, now - 60_000) });
  for (let i = 0; i < 180; i++) {
    const name = `${firsts[i % firsts.length]} ${lasts[(i * 7 + Math.floor(i / firsts.length)) % lasts.length]}`;
    const roll = r();
    // Most records are patients synced from the booking system; the rest are recent leads.
    const stage: Stage = i < 12 ? "new" : i < 24 ? "contacted" : i < 36 ? "booked" : roll < 0.08 ? "lost" : "patient";
    const lead = stage !== "patient";
    const source: Source = lead ? pick(["meta_ad", "meta_ad", "google_ad", "google_ad", "website", "call", "gbp"] as const) : pick(["booking", "booking", "booking", "referral", "gbp"] as const);
    const createdAt = lead ? now - Math.floor(r() * 26 * day) - 3_600_000 : now - Math.floor((200 + r() * 1200) * day);
    const lastVisit = stage === "patient" ? now - Math.floor((r() < 0.12 ? 2 + r() * 10 : 40 + r() * 700) * day) : null;
    const nextAppt = stage === "booked" ? now + Math.floor((0.5 + r() * 12) * day) : stage === "patient" && r() < 0.35 ? now + Math.floor((3 + r() * 60) * day) : null;
    const mobile = r() > 0.12;
    const hasEmail = r() > 0.1;
    const handle = name.toLowerCase().replace(" ", ".");
    const tags = [
      ...(source === "meta_ad" && r() < 0.5 ? ["Invisalign"] : r() < 0.06 ? ["Invisalign"] : []),
      ...(source === "google_ad" && r() < 0.5 ? ["Emergency"] : []),
      ...(r() < 0.25 ? [pick(["Insurance: Delta", "Insurance: Cigna", "No insurance"] as const)] : []),
      ...(stage === "patient" && r() < 0.1 ? ["Kids"] : []),
      ...(stage === "patient" && r() < 0.06 ? ["No-show"] : []),
      ...(stage === "patient" && r() < 0.3 ? ["Left a review"] : []),
    ];
    const detail = source === "meta_ad" || source === "google_ad" ? `${sources[source].label} · ${pick(adDetail[source])}` : source === "booking" ? "NexHealth sync" : sources[source].label;
    const optedOut = stage === "lost" && r() < 0.4;
    const c: Contact = {
      id: `ct${i}`, name, email: hasEmail ? `${handle}@${pick(["gmail.com", "gmail.com", "yahoo.com", "outlook.com", "icloud.com"] as const)}` : null,
      phone: `(512) 555-${String(2000 + i * 37).slice(-4)}`, mobile, stage, source, sourceDetail: detail,
      location: r() < 0.6 ? "South Congress" : "Mueller", tags: [...new Set(tags)],
      value: tags.includes("Invisalign") ? 5200 : tags.includes("Emergency") ? 900 : 1200,
      consent: {
        email: hasEmail && !optedOut, sms: mobile && !optedOut && r() > 0.15,
        how: source === "meta_ad" ? "Ticked the consent box on the Meta lead form" : source === "website" ? "Ticked the consent box on the website form" : source === "booking" ? "Patient intake form" : "Asked in person or on the phone",
      },
      createdAt, lastVisit, nextAppt, notes: "",
    };
    contacts.push(c);
    // Timeline: how they came in, then what's happened since.
    if (source === "meta_ad" || source === "website") ev({ contactId: c.id, at: createdAt, kind: "form", body: `Filled the ${source === "meta_ad" ? "lead form on " + detail.split(" · ")[1] : "contact form on the website"}` });
    if (source === "call" || source === "google_ad") ev({ contactId: c.id, at: createdAt, kind: "call", dir: "in", body: source === "google_ad" ? `from the ${detail.split(" · ").slice(1).join(" · ")} ad` : "Called the office", call: { result: r() < 0.5 ? "missed" : "answered", seconds: 0 }, read: true });
    if (stage !== "new" && lead) ev({ contactId: c.id, at: createdAt + 120_000, kind: "sms", dir: "out", by: "Speed to lead", body: `Hi ${name.split(" ")[0]}, it's ${brandFacts.name}. Thanks for reaching out! Want to grab a time? Book here: ${brandFacts.website}/book or reply with a day that works.` });
    if (stage === "booked") ev({ contactId: c.id, at: createdAt + 3 * 3_600_000, kind: "booking", body: `Booked ${new Date(nextAppt!).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at ${c.location}` });
    if (lastVisit) ev({ contactId: c.id, at: lastVisit, kind: "visit", body: `Visited ${c.location}${c.tags.includes("Kids") ? " with the kids" : ""}` });
    if (stage === "lost") ev({ contactId: c.id, at: createdAt + 2 * day, kind: optedOut ? "sms" : "stage", dir: optedOut ? "in" : undefined, body: optedOut ? "STOP" : "Marked lost: went with another practice", read: true });
  }

  // A few live conversations, so the Inbox has something real in it. Their
  // records are pinned so the details match what they wrote.
  const hr = 3_600_000;
  const fix = (i: number, patch: Partial<Contact>) => Object.assign(contacts[i], patch);
  fix(0, { source: "meta_ad", sourceDetail: "Meta ad · $129 new patient visit", tags: ["Insurance: Delta"], consent: { email: true, sms: true, how: "Ticked the consent box on the Meta lead form" }, mobile: true });
  fix(1, { source: "call", sourceDetail: "Phone call", tags: ["Emergency"], value: 900, consent: { email: false, sms: true, how: "Texted us back after a missed call" }, mobile: true });
  fix(13, { tags: ["Invisalign", "Insurance: Cigna"], value: 5200, consent: { ...contacts[13].consent, email: true } });
  fix(14, { tags: ["Kids"], email: contacts[14].email ?? "carmen.k@gmail.com", consent: { ...contacts[14].consent, email: true } });
  fix(40, { stage: "patient", lastVisit: now - 190 * day, nextAppt: null, mobile: true, consent: { email: true, sms: true, how: "Patient intake form" } });
  fix(52, { stage: "patient", lastVisit: now - 1.2 * day, nextAppt: null, mobile: true, tags: ["Left a review"], consent: { email: true, sms: true, how: "Patient intake form" } });
  fix(100, { tags: [...new Set([...contacts[100].tags, "No-show"])], nextAppt: null });
  const live: { i: number; ago: number; thread: Omit<Event, "id" | "contactId">[] }[] = [
    { i: 0, ago: 0.2, thread: [{ at: 0, kind: "form", body: "Filled the lead form on $129 new patient visit" }, { at: 0.02, kind: "sms", dir: "in", body: "Hi! Is the $129 visit still available? And do you take Delta Dental?" }] },
    { i: 1, ago: 0.7, thread: [{ at: 0, kind: "call", dir: "in", body: "Missed call", call: { result: "missed", seconds: 0 } }, { at: 0.01, kind: "sms", dir: "out", by: "Missed call text-back", body: `Sorry we missed your call! This is ${brandFacts.name}. How can we help? You can also book here: ${brandFacts.website}/book` }, { at: 0.1, kind: "sms", dir: "in", body: "My crown came off while eating lunch. Can someone see me today?" }] },
    { i: 13, ago: 3, thread: [{ at: 0, kind: "email", dir: "out", by: "Free Invisalign consult (Nov)", subject: "Your free Invisalign consult", body: "Hi {{first_name}}, consults are free through November…" }, { at: 2, kind: "email", dir: "in", subject: "Re: Your free Invisalign consult", body: "Hi,\n\nHow much does Invisalign usually cost with insurance? I have Cigna.\n\nThanks" }] },
    { i: 40, ago: 5, thread: [{ at: 0, kind: "sms", dir: "out", by: "October recall", body: "Hi {{first_name}}, it's been 6 months since your last cleaning at Maple & Main. Book here: mapleandmaindental.com/book. Reply STOP to opt out." }, { at: 1, kind: "sms", dir: "in", body: "Can I do Saturday the 8th? Morning if possible" }] },
    { i: 14, ago: 26, thread: [{ at: 0, kind: "email", dir: "in", subject: "New patient question", body: "Do you see kids? My son is 4 and has never been to a dentist." }] },
    { i: 52, ago: 30, thread: [{ at: 0, kind: "sms", dir: "out", by: "Review request", body: "Thanks for coming in today, {{first_name}}! If we took good care of you, a quick Google review helps a lot: g.page/r/maple-main/review" }, { at: 4, kind: "sms", dir: "in", body: "Done! Dr. Patel was great 🙂" }, { at: 5, kind: "sms", dir: "out", by: "You", body: "Thank you so much! See you in 6 months." }] },
  ];
  // Their generated history is replaced by the hand-written one.
  const liveIds = new Set(live.map((l) => contacts[l.i].id));
  for (let k = events.length - 1; k >= 0; k--) if (liveIds.has(events[k].contactId)) events.splice(k, 1);
  live.forEach(({ i }) => { const c = contacts[i]; if (c.lastVisit) ev({ contactId: c.id, at: c.lastVisit, kind: "visit", body: `Visited ${c.location}` }); });
  live.forEach(({ i, ago, thread }) => {
    const c = contacts[i];
    const start = now - ago * hr - (thread[thread.length - 1].at) * hr;
    thread.forEach((t, k) => ev({ ...t, contactId: c.id, at: start + t.at * hr, body: fillFields(t.body, c), read: t.dir === "in" ? ago > 20 || k < thread.length - 1 : undefined }));
  });

  const tasks: CallTask[] = [
    { id: "t1", contactId: contacts[2].id, due: now - 25 * 60_000, reason: "Speed to lead: no reply to the text in 5 minutes", from: "Speed to lead", script: "Hi {{first_name}}, this is {{business}}. You asked about a new patient visit. I can get you in this week, does morning or afternoon work better?" },
    { id: "t2", contactId: contacts[5].id, due: now - 2 * hr, reason: "Speed to lead: no reply to the text in 5 minutes", from: "Speed to lead", script: "Hi {{first_name}}, this is {{business}}. You asked about a new patient visit. I can get you in this week, does morning or afternoon work better?" },
    { id: "t3", contactId: contacts[100].id, due: now + 3 * hr, reason: "No-show win-back: missed yesterday's appointment", from: "No-show win-back", script: "Hi {{first_name}}, we missed you yesterday. Totally fine, things come up. Can I find you a new time?" },
  ];
  return { contacts, events: events.sort((a, b) => a.at - b.at), tasks };
}

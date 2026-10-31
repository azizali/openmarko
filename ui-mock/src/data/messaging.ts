// Sending to contacts. Two kinds of send, the same three channels:
// - A campaign goes once, to a list, on one channel (an email or a text).
// - An automation runs for each person when something happens, as a sequence
//   of texts, emails, waits, call tasks and changes to the contact.
// Calls are never blasted: a call step makes a task for the front desk, with a
// script, in the Inbox. Replies on every channel land in one Inbox.
//
// Triggers are "when something happens" plus "only if" conditions on the
// contact. Something happening can be a change to the contact (a tag added or
// removed, a stage change, joining or leaving a list), a message, an
// appointment, a date, or another automation or campaign, so automations can
// chain. Lists are saved filters, so "joins a list" covers any combination of
// tags, stage and dates without inventing a tag for it.
//
// Real build: email through the business's own domain on the provider they
// connect (data/providers.ts), texts and calls through Twilio or Telnyx (10DLC
// registration; one number per location), every change to a contact written as
// an event that automations subscribe to, automations as durable jobs per
// enrolled contact. Each provider needs a signed BAA before patient data is sent.

import { brandFacts } from "./brand";
import type { SegmentId, Stage } from "./contacts";
import { dnsRecords, type DnsRecord, type EmailProviderId, type PhoneProviderId } from "./providers";

export type Send = "email" | "sms";

export type EventId =
  | "contact_created" | "tag_added" | "tag_removed" | "stage_changed" | "list_joined" | "list_left"
  | "reply_received" | "missed_call" | "link_clicked" | "opted_out"
  | "appt_booked" | "appt_visited" | "appt_no_show" | "appt_cancelled"
  | "date"
  | "automation_finished" | "campaign_received" | "campaign_clicked" | "campaign_replied";
type Needs = "tag" | "stage" | "list" | "keyword" | "date" | "automation" | "campaign";
export const eventMeta: Record<EventId, { label: string; needs?: Needs; hint: string }> = {
  contact_created: { label: "A contact is added", hint: "From an ad, a form, a call, the booking system or by hand. Narrow it with Only if." },
  tag_added: { label: "A tag is added", needs: "tag", hint: "By a person, an import, or another automation's Add a tag step" },
  tag_removed: { label: "A tag is removed", needs: "tag", hint: "" },
  stage_changed: { label: "Their stage changes to", needs: "stage", hint: "" },
  list_joined: { label: "They join a list", needs: "list", hint: "The moment they start matching it, e.g. when a cleaning becomes due" },
  list_left: { label: "They leave a list", needs: "list", hint: "The moment they stop matching it" },
  reply_received: { label: "They reply", needs: "keyword", hint: "By text or email. Leave the word empty for any reply" },
  missed_call: { label: "We miss their call", hint: "Nobody picked up" },
  link_clicked: { label: "They click a link", hint: "In any text or email" },
  opted_out: { label: "They opt out", hint: "STOP by text or unsubscribe by email" },
  appt_booked: { label: "An appointment is booked", hint: "In the booking system or marked Booked here" },
  appt_visited: { label: "They visit", hint: "Checked out in the booking system" },
  appt_no_show: { label: "They miss an appointment", hint: "Marked no-show in the booking system" },
  appt_cancelled: { label: "They cancel", hint: "" },
  date: { label: "A date comes around", needs: "date", hint: "Checked every morning" },
  automation_finished: { label: "Another automation ends for them", needs: "automation", hint: "Chain automations: start this one when that one is done" },
  campaign_received: { label: "They get a campaign", needs: "campaign", hint: "" },
  campaign_clicked: { label: "They click a campaign", needs: "campaign", hint: "Someone who clicked and didn't book is worth a call" },
  campaign_replied: { label: "They reply to a campaign", needs: "campaign", hint: "" },
};
export const eventGroups: { label: string; events: EventId[] }[] = [
  { label: "Contact", events: ["contact_created", "tag_added", "tag_removed", "stage_changed", "list_joined", "list_left"] },
  { label: "Messages", events: ["reply_received", "missed_call", "link_clicked", "opted_out"] },
  { label: "Appointments", events: ["appt_booked", "appt_visited", "appt_no_show", "appt_cancelled"] },
  { label: "Dates", events: ["date"] },
  { label: "Automations & campaigns", events: ["automation_finished", "campaign_received", "campaign_clicked", "campaign_replied"] },
];
export type DateField = "last_visit" | "next_appt" | "birthday" | "created";
export const dateFields: Record<DateField, string> = { last_visit: "last visit", next_appt: "next appointment", birthday: "birthday", created: "date they were added" };
export type When = {
  event: EventId;
  tag?: string;
  stage?: Stage;
  list?: SegmentId;
  keyword?: string;
  date?: { field: DateField; days: number; dir: "before" | "after" };
  automation?: string; // automation id
  ended?: "any" | "finished" | "stopped"; // finished every step, or stopped early (replied, booked…)
  campaign?: string; // campaign id or "any"
};

/** Only-if conditions, all of which must be true when the event happens. */
export type CondField = "tag" | "stage" | "source" | "location" | "can_text" | "can_email";
export type Cond = { field: CondField; op: "is" | "is_not"; values: string[] };
export const condMeta: Record<CondField, { label: string; isLabel: [string, string]; options?: "tags" | "stages" | "sources" | "locations" }> = {
  tag: { label: "Tags", isLabel: ["has any of", "has none of"], options: "tags" },
  stage: { label: "Stage", isLabel: ["is", "is not"], options: "stages" },
  source: { label: "Came from", isLabel: ["is", "is not"], options: "sources" },
  location: { label: "Location", isLabel: ["is", "is not"], options: "locations" },
  can_text: { label: "Can be texted", isLabel: ["yes", "no"] },
  can_email: { label: "Can be emailed", isLabel: ["yes", "no"] },
};

export type StepKind = "wait" | "sms" | "email" | "call" | "stage" | "tag" | "untag" | "start";
export type Wait = { n: number; unit: "minutes" | "hours" | "days"; before?: boolean };
export type Step = {
  id: string;
  kind: StepKind;
  wait?: Wait;
  subject?: string;
  body?: string;
  stage?: Stage;
  tag?: string;
  automation?: string;
  onlyIf?: "no_reply" | "not_booked";
  stats?: { done: number; replied: number; booked: number };
};
export const stepMeta: Record<StepKind, { label: string; hint: string }> = {
  sms: { label: "Send a text", hint: "From the location's number" },
  email: { label: "Send an email", hint: "From your domain" },
  call: { label: "Call task", hint: "The front desk gets a task with a script" },
  wait: { label: "Wait", hint: "" },
  stage: { label: "Move to a stage", hint: "" },
  tag: { label: "Add a tag", hint: "Can start other automations" },
  untag: { label: "Remove a tag", hint: "" },
  start: { label: "Start another automation", hint: "Hands them on; this one carries on too" },
};
export type Exit = "replied" | "booked" | "opted_out";
export const exitMeta: Record<Exit, string> = { replied: "They reply", booked: "They book", opted_out: "They opt out" };

export type Automation = {
  id: string;
  name: string;
  on: boolean;
  when: When;
  only: Cond[];
  steps: Step[];
  exits: Exit[];
  stats: { inNow: number; started30: number; booked30: number };
  recipe?: string;
};

let n = 0;
const s = (kind: StepKind, x: Partial<Step> = {}): Step => ({ id: `st${n++}`, kind, ...x });
const w = (n: number, unit: Wait["unit"], before?: boolean) => s("wait", { wait: { n, unit, before } });
const book = `${brandFacts.website}/book`;

/** Starting points. Each one is a common local-business play, written in the brand voice. */
export const recipes: { id: string; name: string; blurb: string; when: When; only?: Cond[]; exits: Exit[]; steps: () => Step[] }[] = [
  {
    id: "speed", name: "Speed to lead", when: { event: "contact_created" }, only: [{ field: "source", op: "is", values: ["meta_ad", "google_ad", "website", "gbp"] }], exits: ["replied", "booked", "opted_out"],
    blurb: "Text within a minute, call if they don't answer, then follow up for a week. Leads called in the first 5 minutes book far more often.",
    steps: () => [
      w(1, "minutes"),
      s("sms", { body: `Hi {{first_name}}, it's {{business}}! Thanks for reaching out. Book a time: {{booking_link}} or reply with a day that works.`, stats: { done: 214, replied: 71, booked: 38 } }),
      w(5, "minutes"),
      s("call", { onlyIf: "no_reply", body: "Hi {{first_name}}, this is {{business}}. You asked about a new patient visit. I can get you in this week, does morning or afternoon work better?", stats: { done: 118, replied: 0, booked: 21 } }),
      w(1, "days"),
      s("email", { onlyIf: "no_reply", subject: "Your visit at {{business}}", body: "Hi {{first_name}},\n\nThanks for your interest in {{business}}. Here's what to expect at your first visit, and the offer you saw: {{offer}}.\n\nPick any time that suits you: {{booking_link}}\n\nSee you soon,\nThe {{business}} team", stats: { done: 84, replied: 6, booked: 7 } }),
      w(3, "days"),
      s("sms", { onlyIf: "no_reply", body: "Hi {{first_name}}, still want that visit? We have openings this week at {{location}}: {{booking_link}}", stats: { done: 70, replied: 9, booked: 5 } }),
    ],
  },
  {
    id: "missed", name: "Missed call text-back", when: { event: "missed_call" }, only: [{ field: "can_text", op: "is", values: [] }], exits: ["replied", "booked", "opted_out"],
    blurb: "Text anyone whose call we missed, straight away, so they don't call the next dentist on the list.",
    steps: () => [s("sms", { body: `Sorry we missed your call! This is {{business}}. How can we help? You can also book here: {{booking_link}}`, stats: { done: 63, replied: 29, booked: 14 } })],
  },
  {
    id: "reminders", name: "Appointment reminders", when: { event: "appt_booked" }, exits: ["opted_out"],
    blurb: "Confirm right away, remind 2 days and 2 hours before. Fewer no-shows, and they can reschedule by text.",
    steps: () => [
      s("sms", { body: "You're booked at {{business}} {{location}} for {{appt_time}}. Reply C to confirm or R to reschedule.", stats: { done: 156, replied: 118, booked: 0 } }),
      w(2, "days", true),
      s("email", { subject: "See you {{appt_time}}", body: "Hi {{first_name}},\n\nA reminder that you're booked for {{appt_time}} at {{location}}. Parking is free behind the building.\n\nNeed to change it? {{booking_link}}", stats: { done: 149, replied: 4, booked: 0 } }),
      w(2, "hours", true),
      s("sms", { body: "See you at {{appt_time}}, {{first_name}}! Reply R if you need to reschedule.", stats: { done: 141, replied: 22, booked: 0 } }),
    ],
  },
  {
    id: "review", name: "Review request", when: { event: "appt_visited" }, only: [{ field: "tag", op: "is_not", values: ["Left a review"] }], exits: ["opted_out"],
    blurb: "Ask for a Google review 2 hours after the visit, while it's fresh. Helps your map ranking too.",
    steps: () => [
      w(2, "hours"),
      s("sms", { body: "Thanks for coming in today, {{first_name}}! If we took good care of you, a quick Google review helps a lot: {{review_link}}", stats: { done: 132, replied: 18, booked: 0 } }),
      w(3, "days"),
      s("email", { onlyIf: "no_reply", subject: "How was your visit?", body: "Hi {{first_name}},\n\nThanks again for visiting {{business}}. If you have a minute, we'd love a review: {{review_link}}\n\nAnything we could do better? Just reply to this email.", stats: { done: 96, replied: 3, booked: 0 } }),
      s("tag", { tag: "Asked for review" }),
    ],
  },
  {
    id: "recall", name: "6-month recall", when: { event: "list_joined", list: "recall" }, exits: ["booked", "opted_out"],
    blurb: "Email, then text, then a call when a cleaning is due. Most practices' biggest source of booked visits.",
    steps: () => [
      s("email", { subject: "Time for your cleaning, {{first_name}}", body: "Hi {{first_name}},\n\nIt's been about 6 months since your last cleaning at {{business}}. Most plans cover two a year, so this one's likely covered.\n\nBook in a minute: {{booking_link}}", stats: { done: 88, replied: 5, booked: 19 } }),
      w(4, "days"),
      s("sms", { onlyIf: "not_booked", body: "Hi {{first_name}}, it's {{business}}. You're due for a cleaning. Grab a time here: {{booking_link}}", stats: { done: 61, replied: 12, booked: 11 } }),
      w(7, "days"),
      s("call", { onlyIf: "not_booked", body: "Hi {{first_name}}, this is {{business}}. You're due for your cleaning and I have a few openings next week. Would a morning or afternoon be easier?", stats: { done: 34, replied: 0, booked: 8 } }),
    ],
  },
  {
    id: "noshow", name: "No-show win-back", when: { event: "appt_no_show" }, exits: ["replied", "booked", "opted_out"],
    blurb: "A friendly text an hour after, then a call the next day. No guilt.",
    steps: () => [
      w(1, "hours"),
      s("sms", { body: "Hi {{first_name}}, we missed you today. No worries, things come up! Want to pick a new time? {{booking_link}}", stats: { done: 19, replied: 7, booked: 6 } }),
      w(1, "days"),
      s("call", { onlyIf: "not_booked", body: "Hi {{first_name}}, we missed you yesterday. Totally fine, things come up. Can I find you a new time?", stats: { done: 9, replied: 0, booked: 3 } }),
    ],
  },
  {
    id: "invisalign", name: "Invisalign nurture", when: { event: "tag_added", tag: "Invisalign" }, only: [{ field: "stage", op: "is_not", values: ["patient"] }], exits: ["booked", "opted_out"],
    blurb: "Three emails and a text over a week: what it costs, how insurance works, and the free consult.",
    steps: () => [
      s("email", { subject: "Your Invisalign questions, answered", body: "Hi {{first_name}},\n\nThe three things everyone asks: how long it takes, what it costs, and whether it hurts. Here are straight answers…\n\nWhen you're ready: {{booking_link}}" }),
      w(2, "days"),
      s("email", { onlyIf: "not_booked", subject: "What Invisalign costs with insurance", body: "Hi {{first_name}},\n\nMany plans cover part of it. Here's how to check yours, and the monthly payment options we offer…" }),
      w(3, "days"),
      s("sms", { onlyIf: "not_booked", body: "Hi {{first_name}}, {{offer}}. Want one of this week's consult slots? {{booking_link}}" }),
    ],
  },
  {
    id: "lapsed", name: "Win back lapsed patients", when: { event: "list_joined", list: "lapsed" }, exits: ["booked", "opted_out"],
    blurb: "For patients who haven't been in 18 months: a warm email, then a text a week later.",
    steps: () => [
      s("email", { subject: "We miss you at {{business}}", body: "Hi {{first_name}},\n\nIt's been a while! Whatever kept you away, we'd love to see you again. Your next cleaning is easy to book: {{booking_link}}" }),
      w(7, "days"),
      s("sms", { onlyIf: "not_booked", body: "Hi {{first_name}}, it's {{business}}. Ready to get back on track? {{booking_link}}" }),
    ],
  },
  {
    id: "recall2", name: "Recall, second try", when: { event: "automation_finished", automation: "au_recall", ended: "finished" }, exits: ["booked", "opted_out"],
    blurb: "When 6-month recall ends and they still haven't booked, wait a month and try once more with a different angle. Shows how automations chain.",
    steps: () => [
      w(30, "days"),
      s("email", { subject: "Still thinking about that cleaning?", body: "Hi {{first_name}},\n\nNo pressure. When you're ready, Saturday mornings are the easiest to get: {{booking_link}}" }),
      s("tag", { tag: "Recall: no response" }),
    ],
  },
  {
    id: "yes", name: "Reply YES to book", when: { event: "reply_received", keyword: "YES" }, exits: ["opted_out"],
    blurb: "When someone texts YES to a slot you offered, mark them booked and give the front desk a call task to confirm it in the booking system.",
    steps: () => [
      s("stage", { stage: "booked" }),
      s("call", { body: "Hi {{first_name}}, it's {{business}}, just confirming the time you said yes to. Anything we should know before your visit?" }),
    ],
  },
  {
    id: "clicked", name: "Clicked but didn't book", when: { event: "campaign_clicked", campaign: "any" }, only: [{ field: "stage", op: "is_not", values: ["booked"] }], exits: ["booked", "opted_out"],
    blurb: "Anyone who clicks a campaign link and hasn't booked a day later gets a friendly call. Warm, and they already know what it's about.",
    steps: () => [
      w(1, "days"),
      s("call", { onlyIf: "not_booked", body: "Hi {{first_name}}, it's {{business}}. You were looking at booking with us, can I help find a time?" }),
    ],
  },
  {
    id: "birthday", name: "Birthday text", when: { event: "date", date: { field: "birthday", days: 0, dir: "after" } }, only: [{ field: "stage", op: "is", values: ["patient"] }], exits: ["opted_out"],
    blurb: "A short happy-birthday text on the day. No offer, just nice.",
    steps: () => [s("sms", { body: "Happy birthday, {{first_name}}! 🎂 From all of us at {{business}}." })],
  },
];

const fromRecipe = (id: string, stats: Automation["stats"], on = true): Automation => {
  const r = recipes.find((x) => x.id === id)!;
  return { id: `au_${id}`, name: r.name, on, when: r.when, only: r.only ?? [], steps: r.steps(), exits: r.exits, stats, recipe: id };
};
export const seedAutomations = (): Automation[] => [
  fromRecipe("speed", { inNow: 9, started30: 64, booked30: 23 }),
  fromRecipe("missed", { inNow: 2, started30: 31, booked30: 9 }),
  fromRecipe("reminders", { inNow: 24, started30: 71, booked30: 0 }),
  fromRecipe("review", { inNow: 6, started30: 58, booked30: 0 }),
  fromRecipe("recall", { inNow: 37, started30: 44, booked30: 16 }),
  fromRecipe("noshow", { inNow: 1, started30: 6, booked30: 3 }),
  fromRecipe("invisalign", { inNow: 11, started30: 19, booked30: 4 }),
  fromRecipe("recall2", { inNow: 14, started30: 9, booked30: 2 }),
];

// ---------- Campaigns ----------

export type Audience = { segment: SegmentId } | { ids: string[]; label: string };
export type CampaignStats = { sent: number; delivered: number; opened?: number; clicked?: number; replied: number; booked: number; optedOut: number };
export type Campaign = {
  id: string;
  name: string;
  channel: Send;
  audience: Audience;
  subject: string;
  body: string;
  status: "draft" | "scheduled" | "sending" | "sent";
  sendAt: number | null;
  sentAt: number | null;
  stats: CampaignStats | null;
  createdAt: number;
};

const day = 86_400_000;
export const seedCampaigns = (now = Date.now()): Campaign[] => [
  {
    id: "cp_benefits", name: "Use your benefits before Dec 31", channel: "email", audience: { segment: "recall" }, status: "draft", sendAt: null, sentAt: null, stats: null, createdAt: now - day,
    subject: "Your dental benefits reset on Dec 31",
    body: "Hi {{first_name}},\n\nMost dental plans cover two cleanings a year, and whatever you don't use by December 31 is gone.\n\nWe still have openings in November and December at {{location}}, including Saturdays: {{booking_link}}\n\nSee you soon,\nThe {{business}} team",
  },
  {
    id: "cp_inv", name: "Free Invisalign consult (Nov)", channel: "email", audience: { segment: "invisalign" }, status: "sent", sendAt: null, sentAt: now - 3 * day, createdAt: now - 4 * day,
    subject: "Your free Invisalign consult",
    body: "Hi {{first_name}},\n\nConsults are free through November: a 3D scan, a look at what your smile could be, and a straight answer on cost.\n\nPick a time: {{booking_link}}",
    stats: { sent: 112, delivered: 109, opened: 61, clicked: 11, replied: 4, booked: 3, optedOut: 1 },
  },
  {
    id: "cp_oct", name: "October recall", channel: "sms", audience: { segment: "recall" }, status: "sent", sendAt: null, sentAt: now - 9 * day, createdAt: now - 10 * day,
    subject: "",
    body: "Hi {{first_name}}, it's been 6 months since your last cleaning at {{business}}. Book here: {{booking_link}}",
    stats: { sent: 58, delivered: 57, replied: 14, booked: 9, optedOut: 1 },
  },
];

// ---------- Channels (Settings → Email & texting) ----------

export type Reg = "none" | "pending" | "approved" | "rejected";
export type PhoneNumber = { location: string; number: string; how: "new" | "hosted" | "port"; status: "active" | "pending" };
export type Channels = {
  email: { provider: EmailProviderId | null; region?: string; domain: string; verified: boolean; fromName: string; fromAddress: string; replyTo: string; records: DnsRecord[]; footer: string };
  sms: { provider: PhoneProviderId | null; numbers: PhoneNumber[]; brand: Reg; campaign: Reg; quietStart: number; quietEnd: number; optOutLine: string };
  call: { forwardTo: string; recordCalls: boolean; voicemailToText: boolean };
};
export const seedChannels = (): Channels => {
  const domain = `mail.${brandFacts.website}`;
  return {
    email: {
      provider: "ses", region: "us-east-1", domain, verified: true, fromName: brandFacts.name, fromAddress: `hello@${domain}`, replyTo: `frontdesk@${brandFacts.website}`,
      records: dnsRecords("ses", domain).map((r) => ({ ...r, ok: !r.host.startsWith("_dmarc") })),
      footer: "1204 S Congress Ave, Austin, TX 78704",
    },
    sms: {
      provider: "twilio", brand: "approved", campaign: "approved",
      numbers: [{ location: "South Congress", number: "(512) 555-0199", how: "new", status: "active" }, { location: "Mueller", number: "(512) 555-0177", how: "new", status: "active" }],
      quietStart: 8, quietEnd: 21, optOutLine: "Reply STOP to opt out.",
    },
    call: { forwardTo: "Front desk (512) 555-0142", recordCalls: false, voicemailToText: true },
  };
};

import { appHost, product } from "../lib/whitelabel";
// Cold email sequencers OpenMarko can hand prospects to. The sequencer owns
// sending, warmup, inbox rotation and the unibox; OpenMarko pushes leads with
// their audit link as custom variables and listens to its webhooks for replies,
// labels and bounces. Real build (PlusVibe): API key + workspace ID from
// Settings → API (Business plan), leads via the add-leads endpoint (/lead/add),
// webhooks registered with POST /api/v1/hook/add for ALL_EMAIL_REPLIES,
// LEAD_MARKED_AS_<LABEL> and UNIBOX_EMAIL_SENT, replies sent through the
// Unibox "Reply to an email" endpoint. Check each provider's API reference
// before building: the mock doesn't call anything.

export type ProviderId = "plusvibe" | "instantly" | "smartlead";

export const providers: Record<ProviderId, {
  name: string;
  short: string;
  color: string;
  blurb: string;
  has: string[];
  keyWhere: string;
  needsWorkspace: boolean;
  note?: string;
}> = {
  plusvibe: {
    name: "PlusVibe", short: "PV", color: "#7c3aed",
    blurb: "Sequences, unibox and warmup in one. Replies come back here.",
    has: ["Sequencer", "Unibox", "Warmup", "Inbox rotation"],
    keyWhere: "PlusVibe → Settings → API",
    needsWorkspace: true,
    note: "API access needs PlusVibe's Business plan.",
  },
  instantly: {
    name: "Instantly", short: "In", color: "#2563eb",
    blurb: "Large warmup network, campaigns and a unified inbox.",
    has: ["Sequencer", "Unibox", "Warmup"],
    keyWhere: "Instantly → Settings → Integrations → API",
    needsWorkspace: false,
  },
  smartlead: {
    name: "Smartlead", short: "Sl", color: "#0f766e",
    blurb: "Unlimited mailboxes, master inbox and client sub-accounts.",
    has: ["Sequencer", "Unibox", "Warmup", "Client sub-accounts"],
    keyWhere: "Smartlead → Settings → API key",
    needsWorkspace: false,
  },
};

/** OpenMarko fields sent with every lead, usable as {{variables}} in the sequencer's templates. */
export const leadVariables: { key: string; label: string; example: string }[] = [
  { key: "first_name", label: "Owner's first name", example: "Maria" },
  { key: "company", label: "Business name", example: "Lone Star Plumbing" },
  { key: "city", label: "City", example: "Austin" },
  { key: "keyword", label: "Search we checked", example: "plumber" },
  { key: "map_rank", label: "Their Google Maps rank", example: "#7" },
  { key: "top_competitor", label: "Who's #1", example: "Capitol Rooter" },
  { key: "missed_revenue", label: "Missed revenue / mo", example: "$4,200" },
  { key: "quick_win", label: "Their quickest fix", example: "Add 6 photos of recent jobs" },
  { key: "audit_url", label: "Their shared audit link", example: `${appHost()}/a/…` },
];

export type Step = { day: number; subject: string; body: string };
export type Campaign = { id: string; name: string; status: "active" | "paused" | "draft"; leads: number; replyRate: number; steps: Step[]; usesAuditUrl: boolean; fromOpenMarko?: boolean };
export type Inbox = { email: string; warmup: number; dailyLimit: number; sentToday: number; status: "ready" | "warming" | "paused" };

/** The 3-step sequence OpenMarko can create in the sequencer, built around the audit link. */
export const starterSteps: Step[] = [
  {
    day: 0,
    subject: "{{company}} on Google Maps",
    body: `Hi {{first_name}},

I searched “{{keyword}}” in {{city}} and {{company}} shows up {{map_rank}} on Google Maps, behind {{top_competitor}}. The top 3 get most of those calls, about {{missed_revenue}} a month you're not getting.

It's fixable. The quickest win I found: {{quick_win}}.

I put the rest in a one-page audit, with a map of where you rank across town:
{{audit_url}}

Worth a 10-minute walkthrough this week?`,
  },
  {
    day: 3,
    subject: "Re: {{company}} on Google Maps",
    body: `Hi {{first_name}}, just making sure this didn't get buried. The audit shows exactly where {{top_competitor}} is beating you and what to change first:
{{audit_url}}`,
  },
  {
    day: 7,
    subject: "Re: {{company}} on Google Maps",
    body: `Last note from me, {{first_name}}. If ranking higher for “{{keyword}}” isn't a priority right now, no problem. The audit link stays up if you want it later.`,
  },
];

export const starterCampaign = (): Campaign => ({
  id: "c_openmarko", name: `${product()} · Local audit`, status: "active", leads: 0, replyRate: 0, steps: starterSteps, usesAuditUrl: true, fromOpenMarko: true,
});

/** What a workspace looks like once the API key checks out (mock). */
export function workspaceFor(provider: ProviderId) {
  const domain = provider === "plusvibe" ? "getmarkoseo.com" : "trymarkoseo.com";
  const inboxes: Inbox[] = [
    { email: `alex@${domain}`, warmup: 98, dailyLimit: 30, sentToday: 12, status: "ready" },
    { email: `alex.r@${domain}`, warmup: 97, dailyLimit: 30, sentToday: 9, status: "ready" },
    { email: `team@${domain}`, warmup: 95, dailyLimit: 30, sentToday: 14, status: "ready" },
    { email: "alex@markolocal.co", warmup: 92, dailyLimit: 25, sentToday: 6, status: "ready" },
    { email: "hello@markolocal.co", warmup: 71, dailyLimit: 10, sentToday: 0, status: "warming" },
    { email: "alex@brightlinelocal.com", warmup: 88, dailyLimit: 0, sentToday: 0, status: "paused" },
  ];
  const campaigns: Campaign[] = [
    { id: "c_hvac", name: "HVAC owners · Texas", status: "active", leads: 412, replyRate: 4.1, usesAuditUrl: false, steps: [
      { day: 0, subject: "Quick question, {{first_name}}", body: "Hi {{first_name}},\n\nAre you the right person to talk to about getting more calls from Google for {{company}}?" },
      { day: 4, subject: "Re: Quick question, {{first_name}}", body: "Hi {{first_name}}, bumping this up in case it got buried." },
    ] },
    { id: "c_dent", name: "Dentists · Austin metro", status: "paused", leads: 96, replyRate: 6.3, usesAuditUrl: true, steps: starterSteps },
  ];
  return { workspace: provider === "plusvibe" ? "Brightline Growth" : "Brightline Local", inboxes, campaigns };
}

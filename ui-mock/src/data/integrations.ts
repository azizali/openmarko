// Integrations, in three layers:
//
//   Capability  a contract the app needs ("email.send", "reviews.reply"), with the
//               operations a backend adapter implements and the events it emits.
//               Features depend on capabilities, never on a provider.
//   Provider    a catalog entry (Resend, Twilio, Instantly, Meta Ads): how it
//               connects, what it attaches to, which capabilities it implements,
//               and what it does beyond them (extras).
//   Connection  one connected instance of a provider, attached to the Partner,
//               the Organization, a Location or a Website (lib/integrations.ts).
//
// How many connections a capability takes is the capability's call: one email
// sender per Organization, one Google profile per Location, any number of ad
// accounts. Connecting a second provider for a "one" capability replaces the first.
//
// Who may connect follows what it powers: a provider needs the `permission`
// of every capability it implements (data/access.ts), so a Social media
// manager can connect Instagram but not Twilio.
//
// Backend: one interface per capability (its ops), one adapter per provider,
// and invoke(orgId, "email.send", input) resolves the connection. Webhooks are
// normalized into the capability's events, so features subscribe to
// "email.bounced" without knowing who sent it. This file has no React or app
// imports, so the server can use it as-is.

import type { FeatureId } from "./features";
import type { Resource } from "./access";

export type Attach = "partner" | "organization" | "location" | "website";
export const attachLabel: Record<Attach, string> = { partner: "Partner", organization: "Organization", location: "Location", website: "Website" };

export type CapabilityId =
  | "email.send" | "email.receive"
  | "sms.send" | "calls.route"
  | "leads.push" | "leads.replies" | "leads.labels"
  | "ads.read" | "ads.publish" | "ads.conversions" | "calls.track" | "bookings.read" | "creatives.render" | "creatives.design" | "ads.library"
  | "social.publish" | "social.insights" | "social.inbox"
  | "reviews.read" | "reviews.reply" | "profile.edit" | "profile.posts" | "profile.insights"
  | "search.read" | "analytics.read" | "site.write"
  | "notify.send";

export type Capability = {
  id: CapabilityId;
  label: string;
  /** What the app does with it, in a line. */
  does: string;
  per: Attach;
  /** "one": a second connection replaces the first, per `per`. "many": all of them are used. */
  max: "one" | "many";
  /** What connecting or disconnecting something with this capability needs. */
  permission: [Resource, string];
  usedBy: FeatureId[];
  /** The adapter interface: what the backend calls. */
  ops: string[];
  /** What it reports back, normalized from the provider's webhooks. */
  events: string[];
};

const cap = (id: CapabilityId, label: string, does: string, per: Attach, max: Capability["max"], permission: Capability["permission"], usedBy: FeatureId[], ops: string[], events: string[] = []): Capability =>
  ({ id, label, does, per, max, permission, usedBy, ops, events });

export const capabilities: Capability[] = [
  cap("email.send", "Send email", "Campaigns, workflow emails and Inbox replies go out through it", "organization", "one", ["email", "connect"], ["campaigns", "workflows", "inbox"], ["send", "verifyDomain"], ["email.delivered", "email.bounced", "email.complained", "email.opened", "email.clicked"]),
  cap("email.receive", "Receive replies", "Replies land in the Inbox", "organization", "one", ["email", "connect"], ["inbox"], [], ["email.received"]),
  cap("sms.send", "Send texts", "Texts from a local number per location", "organization", "one", ["sms", "connect"], ["campaigns", "workflows", "inbox"], ["send", "searchNumbers", "buyNumber", "register"], ["sms.delivered", "sms.failed", "sms.received", "sms.opted_out"]),
  cap("calls.route", "Calls & voicemail", "Rings the front desk, transcribes voicemail, logs missed calls", "organization", "one", ["sms", "connect"], ["inbox", "workflows"], ["forward"], ["call.completed", "call.missed", "voicemail.received"]),
  cap("leads.push", "Send leads", "Prospects go to a campaign with their audit link", "partner", "one", ["outreach", "connect"], ["outreach"], ["listCampaigns", "createCampaign", "addLeads", "pauseLead"], ["lead.sent"]),
  cap("leads.replies", "Read replies", "Replies and bounces come back to Outreach", "partner", "one", ["outreach", "connect"], ["outreach"], ["listInboxes", "reply"], ["lead.replied", "lead.bounced"]),
  cap("leads.labels", "Sync reply labels", "Interested, not now and other labels stay in step", "partner", "one", ["outreach", "connect"], ["outreach"], ["setLabel"], ["lead.labeled"]),
  cap("ads.read", "Read ad results", "Spend, results and search terms for every campaign", "organization", "many", ["ads", "connect"], ["ads"], ["listCampaigns", "insights"]),
  cap("ads.publish", "Publish ads", "Launches creatives, pauses and changes budgets you approve", "organization", "many", ["ads", "connect"], ["ads", "ad_studio"], ["createAd", "setStatus", "setBudget"], ["ad.rejected", "ad.approved"]),
  cap("ads.conversions", "Report conversions", "Tells the ad platform which clicks booked", "organization", "many", ["ads", "connect"], ["ads"], ["sendConversion"]),
  cap("calls.track", "Track calls from ads", "Counts calls from each ad and how long they lasted", "organization", "one", ["ads", "connect"], ["ads"], ["listCalls"], ["call.tracked"]),
  cap("bookings.read", "Count bookings", "A booked appointment counts as the result, not a form fill", "organization", "one", ["ads", "connect"], ["ads", "customers"], ["listBookings"], ["booking.created", "booking.cancelled"]),
  cap("creatives.render", "Render creatives", "Every size from one design, and scripts into short video", "organization", "one", ["ads", "connect"], ["ad_studio"], ["render"], ["render.done"]),
  cap("creatives.design", "Brand kit & design", "Brand kit in the studio; open any creative to fine-tune", "organization", "one", ["ads", "connect"], ["ad_studio"], ["brandKit", "openDesign"]),
  cap("ads.library", "Import saved ads", "Boards saved elsewhere show up in Ad research", "organization", "many", ["ads", "connect"], ["ad_research"], ["listBoards"]),
  cap("social.publish", "Publish posts", "Posts and scheduled posts go out from this account", "organization", "many", ["social", "connect"], ["social_posts"], ["publish", "schedule"], ["post.published", "post.failed"]),
  cap("social.insights", "Read results", "Followers, reach and what each post did", "organization", "many", ["social", "connect"], ["social", "social_posts"], ["insights"]),
  cap("social.inbox", "Comments & DMs", "Comments and messages show in the Inbox", "organization", "many", ["social", "connect"], ["inbox"], ["reply"], ["comment.received", "message.received"]),
  cap("reviews.read", "Read reviews", "New reviews, with alerts for low ratings", "location", "one", ["seo", "connect"], ["reviews"], ["listReviews"], ["review.received"]),
  cap("reviews.reply", "Reply to reviews", "Posts the replies you approve", "location", "one", ["seo", "connect"], ["reviews"], ["reply"]),
  cap("profile.edit", "Edit Business Profile", "Hours, categories, services and description", "location", "one", ["seo", "connect"], ["seo"], ["getProfile", "updateProfile"]),
  cap("profile.posts", "Google posts", "Updates and offers on Search and Maps", "location", "one", ["seo", "connect"], ["seo", "social_posts"], ["post"]),
  cap("profile.insights", "Calls & directions", "Calls, direction requests and searches from Google", "location", "one", ["seo", "connect"], ["seo"], ["insights"]),
  cap("search.read", "Search queries", "What people searched to find each page", "website", "one", ["setup", "connect"], ["rankings", "content", "site_health"], ["queries", "pages"]),
  cap("analytics.read", "Visits & conversions", "Attributes calls and bookings to search and ads", "website", "one", ["setup", "connect"], ["content", "ads"], ["report"]),
  cap("site.write", "Change the website", "Applies fixes and publishes articles, with a revision to roll back", "website", "one", ["setup", "connect"], ["site_health", "content"], ["updatePage", "publishPost", "revert"]),
  cap("notify.send", "Alerts & digests", "Low reviews, ranking drops and the weekly digest", "organization", "many", ["organization", "update"], [], ["post"]),
];
export const capabilityOf = (id: CapabilityId) => capabilities.find((c) => c.id === id)!;

export type Category = "Email" | "Texting & calls" | "Cold outreach" | "Ads" | "Ad tracking" | "Creative" | "Social" | "Google" | "Website" | "Notifications";
export const categories: Category[] = ["Email", "Texting & calls", "Cold outreach", "Ads", "Ad tracking", "Creative", "Social", "Google", "Website", "Notifications"];

export type Auth = "managed" | "oauth" | "api_key";
export type Field = { key: string; label: string; secret?: boolean; placeholder?: string };

export type ProviderId =
  | "managed_email" | "ses" | "resend" | "mailgun" | "postmark" | "sendgrid"
  | "managed_phone" | "twilio" | "telnyx"
  | "plusvibe" | "instantly" | "smartlead"
  | "meta_ads" | "google_ads" | "tiktok_ads" | "meta_pixel" | "gads_conv" | "callrail" | "booking" | "creatomate" | "canva" | "foreplay"
  | "instagram" | "facebook" | "tiktok" | "x" | "linkedin"
  | "gbp" | "search_console" | "ga4" | "wordpress"
  | "slack";

export type Provider = {
  id: ProviderId;
  name: string;
  /** Who makes it, when that's not obvious from the name (Amazon SES → AWS). */
  vendor?: string;
  mark: string;
  color: string;
  category: Category;
  auth: Auth;
  attach: Attach;
  blurb: string;
  capabilities: CapabilityId[];
  /** What it does that others in its category don't. Shown, not wired to features. */
  extras?: string[];
  /** Another provider that has to be connected first. */
  requires?: ProviderId;
  /** For API key auth. OAuth providers need none. */
  fields?: Field[];
};

const p = (x: Provider) => x;
const email: CapabilityId[] = ["email.send", "email.receive"];
const phone: CapabilityId[] = ["sms.send", "calls.route"];
const gbp: CapabilityId[] = ["reviews.read", "reviews.reply", "profile.edit", "profile.posts", "profile.insights"];

export const providers: Provider[] = [
  // Managed entries are ours; the UI names them with the product (whitelabel).
  p({ id: "managed_email", name: "Managed sending", mark: "MS", color: "#111111", category: "Email", auth: "managed", attach: "organization", blurb: "Nothing to sign up for. We send from your domain on our infrastructure.", capabilities: email, extras: ["Replies handled for you", "Covered by our BAA"] }),
  p({ id: "ses", name: "Amazon SES", vendor: "AWS", mark: "SES", color: "#ff9900", category: "Email", auth: "api_key", attach: "organization", blurb: "Cheapest at volume, in your own AWS account.", capabilities: email, extras: ["Pick the AWS region", "BAA through AWS"], fields: [{ key: "access", label: "Access key ID", placeholder: "AKIA…" }, { key: "secret", label: "Secret access key", secret: true }] }),
  p({ id: "resend", name: "Resend", mark: "R", color: "#000000", category: "Email", auth: "api_key", attach: "organization", blurb: "Simple, developer-friendly email.", capabilities: email, fields: [{ key: "key", label: "API key", secret: true, placeholder: "re_…" }] }),
  p({ id: "mailgun", name: "Mailgun", mark: "MG", color: "#f06b66", category: "Email", auth: "api_key", attach: "organization", blurb: "Long-standing, with inbound routing.", capabilities: email, extras: ["Inbound routes"], fields: [{ key: "key", label: "API key", secret: true }] }),
  p({ id: "postmark", name: "Postmark", mark: "PM", color: "#ffde00", category: "Email", auth: "api_key", attach: "organization", blurb: "Best inbox placement for one-to-one email.", capabilities: email, extras: ["Separate stream for campaigns"], fields: [{ key: "key", label: "Server token", secret: true }] }),
  p({ id: "sendgrid", name: "SendGrid", vendor: "Twilio", mark: "SG", color: "#1a82e2", category: "Email", auth: "api_key", attach: "organization", blurb: "Fine if you already have an account.", capabilities: email, fields: [{ key: "key", label: "API key", secret: true, placeholder: "SG.…" }] }),

  p({ id: "managed_phone", name: "Managed numbers", mark: "MN", color: "#111111", category: "Texting & calls", auth: "managed", attach: "organization", blurb: "We get the numbers and file the carrier registration for you.", capabilities: phone, extras: ["Registration filed for you", "Billed with your plan"] }),
  p({ id: "twilio", name: "Twilio", mark: "Tw", color: "#f22f46", category: "Texting & calls", auth: "api_key", attach: "organization", blurb: "Your own Twilio account and numbers.", capabilities: phone, extras: ["Keep existing numbers"], fields: [{ key: "sid", label: "Account SID", placeholder: "AC…" }, { key: "token", label: "Auth token", secret: true }] }),
  p({ id: "telnyx", name: "Telnyx", mark: "Tx", color: "#00c08b", category: "Texting & calls", auth: "api_key", attach: "organization", blurb: "Lower per-message cost, own network.", capabilities: phone, fields: [{ key: "key", label: "API key", secret: true }] }),

  p({ id: "plusvibe", name: "PlusVibe", mark: "PV", color: "#6d28d9", category: "Cold outreach", auth: "api_key", attach: "partner", blurb: "Sequencer with warmup and a unibox.", capabilities: ["leads.push", "leads.replies"], extras: ["Unibox", "Warmup"], fields: [{ key: "key", label: "API key", secret: true }] }),
  p({ id: "instantly", name: "Instantly", mark: "In", color: "#2563eb", category: "Cold outreach", auth: "api_key", attach: "partner", blurb: "Inbox rotation at scale.", capabilities: ["leads.push", "leads.replies", "leads.labels"], extras: ["Inbox placement tests", "Warmup"], fields: [{ key: "key", label: "API key", secret: true }] }),
  p({ id: "smartlead", name: "Smartlead", mark: "SL", color: "#0ea5e9", category: "Cold outreach", auth: "api_key", attach: "partner", blurb: "Unlimited inboxes and subsequences.", capabilities: ["leads.push", "leads.replies", "leads.labels"], extras: ["Subsequences", "Client sub-accounts"], fields: [{ key: "key", label: "API key", secret: true }] }),

  p({ id: "meta_ads", name: "Meta Ads", mark: "M", color: "#0866ff", category: "Ads", auth: "oauth", attach: "organization", blurb: "Facebook and Instagram ads.", capabilities: ["ads.read", "ads.publish"] }),
  p({ id: "google_ads", name: "Google Ads", mark: "G", color: "#1a73e8", category: "Ads", auth: "oauth", attach: "organization", blurb: "Search ads, search terms, budgets and bids.", capabilities: ["ads.read", "ads.publish"], extras: ["Search terms and negatives"] }),
  p({ id: "tiktok_ads", name: "TikTok Ads", mark: "TT", color: "#111111", category: "Ads", auth: "oauth", attach: "organization", blurb: "Short video ads.", capabilities: ["ads.read", "ads.publish"] }),
  p({ id: "meta_pixel", name: "Meta Pixel + Conversions API", mark: "Px", color: "#0866ff", category: "Ad tracking", auth: "oauth", attach: "organization", blurb: "Tells Meta which clicks booked, so it finds more people like them.", capabilities: ["ads.conversions"], requires: "meta_ads" }),
  p({ id: "gads_conv", name: "Google Ads conversions", mark: "Cv", color: "#1a73e8", category: "Ad tracking", auth: "oauth", attach: "organization", blurb: "Bookings and calls counted in Google Ads.", capabilities: ["ads.conversions"], extras: ["Enhanced conversions"], requires: "google_ads" }),
  p({ id: "callrail", name: "CallRail", mark: "CR", color: "#0e7a5f", category: "Ad tracking", auth: "oauth", attach: "organization", blurb: "Tracking numbers per ad and call length.", capabilities: ["calls.track"] }),
  p({ id: "booking", name: "NexHealth", mark: "NH", color: "#7c3aed", category: "Ad tracking", auth: "oauth", attach: "organization", blurb: "Your booking system, so a booked patient is the result.", capabilities: ["bookings.read"] }),
  p({ id: "creatomate", name: "Creatomate", mark: "Cm", color: "#ef4444", category: "Creative", auth: "api_key", attach: "organization", blurb: "Renders every size and turns scripts into video.", capabilities: ["creatives.render"], fields: [{ key: "key", label: "API key", secret: true }] }),
  p({ id: "canva", name: "Canva", mark: "Ca", color: "#00c4cc", category: "Creative", auth: "oauth", attach: "organization", blurb: "Your brand kit, and fine-tuning in Canva.", capabilities: ["creatives.design"] }),
  p({ id: "foreplay", name: "Foreplay", mark: "Fp", color: "#f97316", category: "Creative", auth: "api_key", attach: "organization", blurb: "Bring in boards you've saved there.", capabilities: ["ads.library"], fields: [{ key: "key", label: "API key", secret: true }] }),

  p({ id: "instagram", name: "Instagram", mark: "IG", color: "#e1306c", category: "Social", auth: "oauth", attach: "organization", blurb: "Posts, reels and stories.", capabilities: ["social.publish", "social.insights", "social.inbox"] }),
  p({ id: "facebook", name: "Facebook", mark: "f", color: "#1877f2", category: "Social", auth: "oauth", attach: "organization", blurb: "Page posts.", capabilities: ["social.publish", "social.insights", "social.inbox"] }),
  p({ id: "tiktok", name: "TikTok", mark: "TT", color: "#111111", category: "Social", auth: "oauth", attach: "organization", blurb: "Short videos.", capabilities: ["social.publish", "social.insights"] }),
  p({ id: "x", name: "X", mark: "X", color: "#111111", category: "Social", auth: "oauth", attach: "organization", blurb: "Posts and threads.", capabilities: ["social.publish", "social.insights"] }),
  p({ id: "linkedin", name: "LinkedIn", mark: "in", color: "#0a66c2", category: "Social", auth: "oauth", attach: "organization", blurb: "Posts from a profile or page.", capabilities: ["social.publish"] }),

  p({ id: "gbp", name: "Google Business Profile", mark: "G", color: "#34a853", category: "Google", auth: "oauth", attach: "location", blurb: "Reviews, profile, posts, calls and directions for one location.", capabilities: gbp }),
  p({ id: "search_console", name: "Search Console", mark: "SC", color: "#4285f4", category: "Website", auth: "oauth", attach: "website", blurb: "Search queries and pages from Google.", capabilities: ["search.read"] }),
  p({ id: "ga4", name: "Google Analytics 4", mark: "GA", color: "#e37400", category: "Website", auth: "oauth", attach: "website", blurb: "Visits and conversions.", capabilities: ["analytics.read"] }),
  p({ id: "wordpress", name: "WordPress", mark: "WP", color: "#21759b", category: "Website", auth: "api_key", attach: "website", blurb: "Applies fixes and publishes articles.", capabilities: ["site.write"], extras: ["Yoast and Rank Math detected"], fields: [{ key: "user", label: "Username" }, { key: "password", label: "Application password", secret: true }] }),

  p({ id: "slack", name: "Slack", mark: "#", color: "#4a154b", category: "Notifications", auth: "oauth", attach: "organization", blurb: "Alerts and weekly digests in a channel.", capabilities: ["notify.send"] }),
];
export const providerOf = (id: ProviderId) => providers.find((x) => x.id === id)!;
export const providersFor = (c: CapabilityId) => providers.filter((x) => x.capabilities.includes(c));
/** Everything needed to connect or disconnect it: the permission of each capability it implements. */
export const permissionsFor = (x: Provider) => [...new Map(x.capabilities.map((c) => { const pm = capabilityOf(c).permission; return [pm.join("."), pm]; })).values()];

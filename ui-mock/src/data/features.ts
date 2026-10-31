// What an Organization uses. Each feature belongs to a module (a sidebar
// section) and may depend on others. A feature works only when:
//   it's on  AND  its module is on  AND  what it needs is on (any one of needsAny).
// Being on is a choice; being connected (an ad account, a sending domain, a
// sequencer) is separate, and each page already handles "not connected yet".
//
// Turning something off hides its pages (sidebar, command palette, Settings
// sections) and the controls for it that appear inside other features: `off`
// says where. Nothing is deleted; turning it back on restores everything.
//
// Real build: a features JSON column on organizations, read by the API too, so
// a turned-off feature also stops its background jobs (scans, sends, reviews).

export type FeatureId =
  | "seo" | "rankings" | "ai_answers" | "reviews" | "content" | "citations" | "site_health"
  | "social" | "social_scanner" | "social_swipe" | "social_posts"
  | "ads" | "ad_research" | "ad_studio"
  | "customers" | "inbox" | "email" | "sms" | "campaigns" | "workflows"
  | "sales" | "outreach"
  | "marko";

export type Connection = "social_accounts" | "ad_account" | "email_sending" | "texting" | "sequencer";

export type Feature = {
  id: FeatureId;
  label: string;
  blurb: string;
  module?: FeatureId; // absent on modules themselves
  needsAny?: FeatureId[];
  connection?: Connection;
  links?: string[]; // pages it owns (paths, or paths with a query)
  settings?: string[]; // Settings sections it owns
  off?: string; // what else changes when it's off
  agencyOnly?: boolean;
};

export const features: Feature[] = [
  { id: "seo", label: "Local SEO", blurb: "Rankings, reviews, citations and your Business Profile.", links: ["/profile"], off: "Home leaves out search numbers." },
  { id: "rankings", module: "seo", label: "Rankings & competitors", blurb: "Keyword and map pack tracking, competitors, ranking factors, keyword ideas.", links: ["/rankings", "/competitors", "/factors", "/keywords"] },
  { id: "ai_answers", module: "seo", label: "AI answers", blurb: "Whether ChatGPT, Gemini and others recommend you.", links: ["/ai"] },
  { id: "reviews", module: "seo", label: "Reviews", blurb: "Read and reply to Google reviews.", links: ["/profile?tab=reviews"], off: "The Reviews tab leaves Business Profile." },
  { id: "content", module: "seo", label: "Articles", blurb: "Marko drafts articles for your site.", links: ["/content"] },
  { id: "citations", module: "seo", label: "Citations & backlinks", blurb: "Directory listings and links to your site.", links: ["/citations"] },
  { id: "site_health", module: "seo", label: "Site health", blurb: "Technical issues on your website.", links: ["/audit"] },

  { id: "social", label: "Social media", blurb: "Find what's working, save ideas, plan and publish posts.", links: ["/social"], off: "Home leaves out the social summary." },
  { id: "social_scanner", module: "social", label: "Social scanner", blurb: "Trending posts and accounts to learn from.", links: ["/social/scanner"] },
  { id: "social_swipe", module: "social", label: "Swipe file", blurb: "Posts you've saved for ideas.", links: ["/social/swipe"] },
  { id: "social_posts", module: "social", label: "Posts & calendar", blurb: "Plan, schedule and publish to your accounts.", links: ["/social/posts"], connection: "social_accounts" },

  { id: "ads", label: "Ads", blurb: "Run Meta, Google and TikTok ads against a cost per booked patient.", links: ["/ads"], settings: ["ads"], connection: "ad_account" },
  { id: "ad_research", module: "ads", label: "Ad research & swipe file", blurb: "See competitors' ads and save the ones that work.", links: ["/ads/research"] },
  { id: "ad_studio", module: "ads", label: "Creative studio", blurb: "Make ad creatives in bulk and publish them.", links: ["/ads/studio"], off: "“Make creatives”, “Make variations” and “Make my versions” leave Campaigns and Ad research; recommendations to make fresh versions are left out." },

  { id: "customers", label: "Contacts & messaging", blurb: "Your CRM, and email, texts and calls with customers.", links: ["/contacts"], settings: ["messaging"] },
  { id: "email", module: "customers", label: "Email", blurb: "Send from your own domain.", connection: "email_sending", off: "Email leaves the reply box, campaigns and the step list; email steps in workflows are skipped." },
  { id: "sms", module: "customers", label: "Texting", blurb: "Text from a local number per location.", connection: "texting", off: "Text leaves the reply box, campaigns and the step list; text steps in workflows are skipped." },
  { id: "inbox", module: "customers", label: "Inbox", blurb: "Every reply on every channel in one place.", links: ["/inbox"], needsAny: ["email", "sms"], off: "“Open in Inbox” leaves the contact drawer." },
  { id: "campaigns", module: "customers", label: "Campaigns", blurb: "One email or text to a list.", links: ["/campaigns"], needsAny: ["email", "sms"], off: "Text and Email leave the Contacts selection bar." },
  { id: "workflows", module: "customers", label: "Workflows", blurb: "Sequences that run when something happens.", links: ["/workflows"], off: "Nothing starts automatically; Workflow leaves the Contacts selection bar and the contact drawer." },

  { id: "sales", label: "Prospecting", blurb: "Find and audit businesses to sell to.", links: ["/prospects"], agencyOnly: true },
  { id: "outreach", module: "sales", label: "Outreach", blurb: "Send prospects to your cold email sequencer and answer replies.", links: ["/outreach"], settings: ["outreach"], connection: "sequencer", agencyOnly: true, off: "Prospecting stays; “Send to campaign” and sequence badges leave prospects and audits." },

  { id: "marko", label: "Marko assistant", blurb: "Ask questions and give instructions in chat.", off: "The chat panel, ⌘J, “Ask Marko” in search and the reply box on Home are hidden." },
];

export const featureOf = (id: FeatureId) => features.find((f) => f.id === id)!;
export const modules = features.filter((f) => !f.module);
export const childrenOf = (id: FeatureId) => features.filter((f) => f.module === id);

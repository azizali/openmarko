/**
 * Competitor facts come only from docs/research/reports/Local SEO competitor landscape.md
 * (researched October 2026 from vendor pages). "?" means the sources neither confirm
 * nor rule it out. Re-check before publishing: vendors change fast.
 */
export type Cell = "yes" | "no" | "partial" | "?";

export const AS_OF = "October 2026";

export const capabilities = [
  "Map pack geo-grid tracking",
  "Competitor grids and benchmarking",
  "Ranking-factor analysis",
  "AI search visibility",
  "Google posts",
  "AI review replies",
  "Site audit",
  "One-click WordPress fixes",
  "Unified To-do / autopilot",
  "Listings distribution",
  "White-label reports",
  "Prospect discovery by keyword and radius",
  "Ease-of-sale scoring",
  "Owner contact enrichment",
  "Missed revenue and pitch per prospect",
  "Built-in CRM and outreach",
  "Visible data cost per scan",
] as const;

/** OpenMarko's own column. Listings, CRM and white-label audits are honest gaps. */
export const openmarko: Cell[] = ["yes", "yes", "yes", "yes", "yes", "yes", "yes", "yes", "yes", "no", "partial", "yes", "yes", "yes", "yes", "no", "yes"];

export type Competitor = {
  slug: string;
  name: string;
  kind: string;
  oneLine: string;
  pricing: string;
  contract: string;
  cells: Cell[];
  theyWin: string[];
  weWin: string[];
  chooseThem: string;
  chooseUs: string;
  sources: { label: string; url: string }[];
};

export const competitors: Competitor[] = [
  {
    slug: "local-falcon",
    name: "Local Falcon",
    kind: "Geo-grid specialist",
    oneLine: "The category leader for geo-grid scans, now adding AI agents and AI-visibility grids.",
    pricing: "Credits at 1 per grid point: $24.99 for 7,500 up to $199.99 for 63,150; pay-as-you-go $0.05 per credit.",
    contract: "Monthly credits expire each cycle; annual credits roll over.",
    cells: ["yes", "yes", "partial", "yes", "yes", "yes", "partial", "no", "partial", "no", "yes", "no", "no", "partial", "no", "no", "partial"],
    theyWin: ["AI visibility across 7 engines on the same grid, including Apple Maps and Grok", "An MCP server for connecting AI assistants", "A long track record and strongly positive reviews"],
    weWin: ["Finds new prospects by keyword and radius, which Local Falcon doesn't", "Applies website fixes in one click", "Flat monthly pricing with credits that never expire"],
    chooseThem: "you mainly need deep grid scanning across many engines and already have your own lead list.",
    chooseUs: "you want the fixes done, not only measured, or you need to find and sign new clients.",
    sources: [
      { label: "Local Falcon pricing", url: "https://www.localfalcon.com/pricing" },
      { label: "Local Falcon llms.txt", url: "https://www.localfalcon.com/llms.txt" },
    ],
  },
  {
    slug: "brightlocal",
    name: "BrightLocal",
    kind: "All-in-one local suite",
    oneLine: "A broad local SEO suite with tracking, audits, listings and reviews, popular with agencies.",
    pricing: "Track from $41/mo ($31 billed annually), Grow $65/mo; roughly $5–10 per location at 100 locations.",
    contract: "Monthly or annual; prices rose in July 2026.",
    cells: ["yes", "yes", "partial", "yes", "yes", "partial", "yes", "no", "no", "yes", "yes", "no", "no", "no", "no", "no", "no"],
    theyWin: ["Listings distribution through five data aggregators", "Very low per-location price at agency scale", "A mature product with 15,000+ customers"],
    weWin: ["A To-do that does the work, where BrightLocal reports it", "Review replies on autopilot, where BrightLocal covers Google and Facebook only", "Prospecting and sales audits to win new clients"],
    chooseThem: "you need citation building and listings management across many directories.",
    chooseUs: "you'd rather have the fixes applied for you than another dashboard to read.",
    sources: [{ label: "BrightLocal pricing", url: "https://www.brightlocal.com/pricing/" }],
  },
  {
    slug: "gohighlevel",
    name: "GoHighLevel",
    kind: "Agency operating system",
    oneLine: "The agency CRM and marketing platform, with local SEO resold from Search Atlas and Yext.",
    pricing: "$97/mo (3 sub-accounts), $297 unlimited, $497 SaaS mode. SEO add-on $79 and listings $30 per client.",
    contract: "No contract, but per-client modules stack up.",
    cells: ["yes", "yes", "?", "?", "?", "partial", "yes", "partial", "partial", "yes", "yes", "yes", "no", "?", "partial", "yes", "no"],
    theyWin: ["A full CRM, email and SMS outreach and client billing", "Built-in AI prospecting with heatmaps per pin", "Listings through Yext"],
    weWin: ["Ease-of-sale scores and owner contacts on every prospect", "An audit that becomes the client's task list when they sign", "Local SEO for one flat price, instead of about $109 per client in add-ons"],
    chooseThem: "you want one system to run your whole agency, CRM and billing included.",
    chooseUs: "local SEO is your service and you want it done better and cheaper per client. You can keep GoHighLevel as your CRM and use OpenMarko for the local SEO work.",
    sources: [
      { label: "GoHighLevel pricing", url: "https://www.gohighlevel.com/pricing" },
      { label: "GHL help: Free vs Premium Prospecting", url: "https://help.gohighlevel.com/support/solutions/articles/155000005458-free-vs-premium-prospecting-in-gohighlevel-complete-guide-for-agencies" },
      { label: "Search Atlas and HighLevel release", url: "https://searchatlas.com/blog/search-atlas-and-highlevel-bring-ai-powered-seo-to-1-and-a-half-million-businesses/" },
    ],
  },
  {
    slug: "semrush-local",
    name: "Semrush Local",
    kind: "All-in-one local suite",
    oneLine: "Semrush's local toolkit, with a Google Business Profile AI agent, heatmaps and listings.",
    pricing: "$30 per location (Base) or $60 (Pro), billed annually.",
    contract: "Annual billing; no free trial.",
    cells: ["yes", "yes", "partial", "?", "yes", "yes", "?", "no", "partial", "yes", "yes", "partial", "no", "?", "no", "no", "no"],
    theyWin: ["Listings to 70+ directories", "A strong brand and the wider Semrush SEO toolset", "A profile AI agent that posts and replies"],
    weWin: ["Website fixes applied for you, not only profile changes", "Month-to-month with no annual commitment", "Sales audits and prospecting for agencies"],
    chooseThem: "you already live in Semrush for national SEO and want local in the same account.",
    chooseUs: "local is the whole game for you and you want one To-do that covers your profile and your website.",
    sources: [
      { label: "Semrush Local pricing", url: "https://www.semrush.com/pricing/local/" },
      { label: "Semrush KB: Local toolkit plans", url: "https://www.semrush.com/kb/1611-local-toolkit-pricing-and-plans" },
    ],
  },
  {
    slug: "synup",
    name: "Synup",
    kind: "Local suite for SMBs and agencies",
    oneLine: "Month-to-month local marketing with rank grids, listings and AI visibility.",
    pricing: "$49/mo for 1 location; $299 for 10, $499 for 25, $899 for 50.",
    contract: "Month-to-month, 14-day trial.",
    cells: ["yes", "yes", "partial", "yes", "yes", "yes", "no", "no", "partial", "yes", "yes", "no", "no", "no", "no", "no", "partial"],
    theyWin: ["Listings distribution and a listings agent", "Public, simple pricing by location tier", "White label from Premium up"],
    weWin: ["A website audit with one-click fixes, which Synup doesn't have", "Prospecting and sales audits for agencies", "Ranking-factor analysis against the businesses above you"],
    chooseThem: "listings accuracy across many directories is your main problem.",
    chooseUs: "your website and profile need fixing and you want it done from one list.",
    sources: [{ label: "Synup pricing", url: "https://www.synup.com/pricing" }],
  },
];

export const competitorBySlug = (slug: string) => competitors.find((c) => c.slug === slug);

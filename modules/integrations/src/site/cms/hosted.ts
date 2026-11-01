import type { SiteSpec } from "../contract";

// Hosted CMSs. Each supports every op in the contract; until its live calls are written (ADR 0013, stub-first),
// a live connection answers 501 and a stub connection works end to end.
export const webflowSite: SiteSpec = { provider: "webflow", supports: () => true, live: {} };
export const shopifySite: SiteSpec = { provider: "shopify", supports: () => true, live: {} };
export const ghostSite: SiteSpec = { provider: "ghost", supports: () => true, live: {} };

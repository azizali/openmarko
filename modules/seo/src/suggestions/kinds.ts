// The kinds of suggestion: what each one carries, which check it should move, the action applying it needs, and the
// automation Task kind that applies it. Payloads are checked by zod when a suggestion is written and when it's applied.

import { z } from "zod";
import type { SeoAction } from "../access";

export const suggestionKinds = ["track_keyword", "track_question", "profile_change", "post", "listing", "site_fix"] as const;
export type SuggestionKind = (typeof suggestionKinds)[number];

/** The check a suggestion should move. */
export type Helps = "maps" | "keywords" | "ai";
const helps = z.enum(["maps", "keywords", "ai"]);

/** Where a suggestion comes from, as the Action plan groups them. */
export type Source = "tracking" | "profile" | "listings" | "audit";

export const payloadSchemas = {
  track_keyword: z.object({ term: z.string().min(2), monthlySearches: z.number().nullable() }),
  track_question: z.object({ text: z.string().min(8) }),
  profile_change: z.discriminatedUnion("field", [
    z.object({ field: z.literal("categories"), before: z.array(z.string()), after: z.array(z.string()) }),
    z.object({ field: z.literal("description"), before: z.string(), after: z.string().min(20).max(750) }),
  ]),
  post: z.object({ text: z.string().min(20).max(1500) }),
  listing: z.object({ domain: z.string(), citedIn: z.number(), answers: z.number() }),
  // One kind of issue a site audit found, with how to fix it (audit/fixes.ts). `helps` is every check it holds back.
  site_fix: z.object({
    code: z.string(),
    count: z.number().int().min(1),
    items: z.array(z.string()),
    sample: z.array(z.string()),
    helps: z.array(helps).min(1),
    steps: z.array(z.string()).min(1),
    snippet: z.object({ label: z.string(), text: z.string() }).nullable(),
  }),
} satisfies Record<SuggestionKind, z.ZodType>;

export type Payload<K extends SuggestionKind> = z.infer<(typeof payloadSchemas)[K]>;

/**
 * Per kind: the check it moves (a site fix's own `helps` says which, per issue), the action applying it needs, the
 * Task kind that applies it, whether it needs the Google profile linked, and whether it's done by hand. A kind done
 * by hand is only marked done, so Autopilot never applies it: nobody has done the work.
 */
export const kindInfo: Record<
  SuggestionKind,
  { helps: Helps; source: Source; action: SeoAction; task: string; needsProfile: boolean; byHand: boolean }
> = {
  track_keyword: { helps: "keywords", source: "tracking", action: "track", task: "seo.track_keyword", needsProfile: false, byHand: false },
  track_question: { helps: "ai", source: "tracking", action: "track", task: "seo.track_question", needsProfile: false, byHand: false },
  profile_change: { helps: "maps", source: "profile", action: "publish", task: "seo.profile_change", needsProfile: true, byHand: false },
  post: { helps: "maps", source: "profile", action: "publish", task: "seo.post", needsProfile: true, byHand: false },
  // Getting listed is done by hand; applying marks it done.
  listing: { helps: "ai", source: "listings", action: "track", task: "seo.listing", needsProfile: false, byHand: true },
  // The site is the customer's own: the fix is made there, marked done here, and checked by the next audit.
  site_fix: { helps: "keywords", source: "audit", action: "track", task: "seo.site_fix", needsProfile: false, byHand: true },
};

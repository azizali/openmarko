// The kinds of suggestion: what each one carries, which check it should move, the action applying it needs, and the
// automation Task kind that applies it. Payloads are checked by zod when a suggestion is written and when it's applied.

import { z } from "zod";
import type { SeoAction } from "../access";

export const suggestionKinds = ["track_keyword", "track_question", "profile_change", "post", "listing"] as const;
export type SuggestionKind = (typeof suggestionKinds)[number];

/** The check a suggestion should move. */
export type Helps = "maps" | "keywords" | "ai";

export const payloadSchemas = {
  track_keyword: z.object({ term: z.string().min(2), monthlySearches: z.number().nullable() }),
  track_question: z.object({ text: z.string().min(8) }),
  profile_change: z.discriminatedUnion("field", [
    z.object({ field: z.literal("categories"), before: z.array(z.string()), after: z.array(z.string()) }),
    z.object({ field: z.literal("description"), before: z.string(), after: z.string().min(20).max(750) }),
  ]),
  post: z.object({ text: z.string().min(20).max(1500) }),
  listing: z.object({ domain: z.string(), citedIn: z.number(), answers: z.number() }),
} satisfies Record<SuggestionKind, z.ZodType>;

export type Payload<K extends SuggestionKind> = z.infer<(typeof payloadSchemas)[K]>;

export const kindInfo: Record<SuggestionKind, { helps: Helps; action: SeoAction; task: string; needsProfile: boolean }> = {
  track_keyword: { helps: "keywords", action: "track", task: "seo.track_keyword", needsProfile: false },
  track_question: { helps: "ai", action: "track", task: "seo.track_question", needsProfile: false },
  profile_change: { helps: "maps", action: "publish", task: "seo.profile_change", needsProfile: true },
  post: { helps: "maps", action: "publish", task: "seo.post", needsProfile: true },
  // Getting listed is done by hand; applying marks it done.
  listing: { helps: "ai", action: "track", task: "seo.listing", needsProfile: false },
};

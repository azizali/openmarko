// What `profile.manage` (Google Business Profile) takes and returns. Provider-neutral in shape; Google is the only
// provider today. A location is named the way the v4 API names it: `accounts/<id>/locations/<id>`.

export type ProfileLocation = { name: string; title: string; address: string | null; placeId: string | null };

export type Profile = {
  title: string;
  primaryCategory: string | null;
  additionalCategories: string[];
  description: string | null;
  website: string | null;
  phone: string | null;
  /** Opening hours are set. */
  hasHours: boolean;
};

/** A change to apply. Categories are display names ("Emergency dental service"). */
export type ProfileChange = { additionalCategories?: string[]; description?: string };

export type DailyMetrics = {
  /** YYYY-MM-DD */
  day: string;
  calls: number;
  websiteClicks: number;
  directionRequests: number;
  impressionsMaps: number;
  impressionsSearch: number;
};

export type ProfileInput =
  | { op: "locations" }
  | { op: "read"; location: string }
  | { op: "update"; location: string; change: ProfileChange }
  | { op: "post"; location: string; text: string }
  | { op: "deletePost"; post: string }
  | { op: "performance"; location: string; from: string; to: string }
  | { op: "searchTerms"; location: string; month: string };

export type ProfileOutput =
  | { locations: ProfileLocation[] }
  | { profile: Profile }
  | { ok: true }
  | { post: string }
  | { days: DailyMetrics[] }
  | { terms: { term: string; impressions: number }[] };

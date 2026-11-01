import type { Adapter } from "./types";
import { AppError } from "@openmarko/kernel";
import { createHash } from "node:crypto";

// Google Business Profile. Free to use, so no metering (ADR 0012). Stub data is deterministic per profile.
type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Google's access tokens expire after an hour. The connection stores a refresh token; this exchanges it for a
 * fresh access token on each live call. Without a refresh token, the stored access token is used as it is.
 */
export async function googleAccessToken(
  s: Record<string, string>,
  google: { clientId?: string; clientSecret?: string },
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  if (!s.refreshToken) return s.accessToken ?? "";
  if (!google.clientId || !google.clientSecret) {
    throw new AppError(503, "not_configured", "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are needed to refresh Google access.");
  }
  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: google.clientId,
      client_secret: google.clientSecret,
      refresh_token: s.refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  const json = (await res.json()) as { access_token?: string; error?: string };
  if (!res.ok || !json.access_token) throw new AppError(502, "provider_error", `Google refused the refresh: ${json.error ?? res.status}`);
  return json.access_token;
}
export type GbpReview = { reviewId: string; rating: number; text: string; author: string; createdAt: string; reply: string | null };

const stubReviews = (gbpId: string): GbpReview[] => {
  const n = 3 + (createHash("sha256").update(gbpId).digest()[0]! % 4);
  return Array.from({ length: n }, (_, i) => ({
    reviewId: `${gbpId}/reviews/${i + 1}`,
    rating: [5, 5, 4, 3, 2][i % 5]!,
    text: i % 3 === 2 ? "Waited a long time at the front desk." : "Friendly team and quick appointment.",
    author: `Patient ${i + 1}`,
    createdAt: new Date(Date.now() - i * 86_400_000).toISOString(),
    reply: null,
  }));
};

export const gbp: Adapter = {
  provider: "gbp",
  capabilities: ["reviews.read", "reviews.reply", "profile.edit", "profile.posts", "profile.insights"],
  call: async (capability, input, { mode, externalId, secrets, google }) => {
    if (mode === "stub") {
      if (capability === "reviews.read") return { output: stubReviews(externalId ?? "stub"), quantity: 1, costMicros: 0 };
      if (capability === "reviews.reply") return { output: { ok: true, reviewId: input.reviewId }, quantity: 1, costMicros: 0 };
      if (capability === "profile.edit") return { output: { ok: true, updateMask: input.updateMask }, quantity: 1, costMicros: 0 };
      if (capability === "profile.insights") return { output: { calls: 120, directions: 45, searches: 900 }, quantity: 1, costMicros: 0 };
      return { output: { ok: true }, quantity: 1, costMicros: 0 };
    }
    // Live: the Google access token is refreshed from the stored refresh token by the caller (see connections).
    const accessToken = await googleAccessToken((await secrets()) as Record<string, string>, google);
    const headers = { authorization: `Bearer ${accessToken}`, "content-type": "application/json" };
    if (capability === "reviews.reply") {
      const res = await fetch(`https://mybusiness.googleapis.com/v4/${input.reviewName}/reply`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ comment: input.text }),
      });
      if (!res.ok) throw new AppError(502, "provider_error", `Google returned ${res.status}`);
      return { output: { ok: true }, quantity: 1, costMicros: 0 };
    }
    if (capability === "reviews.read") {
      const res = await fetch(`https://mybusiness.googleapis.com/v4/${externalId}/reviews`, { headers });
      if (!res.ok) throw new AppError(502, "provider_error", `Google returned ${res.status}`);
      const json = (await res.json()) as { reviews?: any[] };
      const reviews: GbpReview[] = (json.reviews ?? []).map((r) => ({
        reviewId: r.name,
        rating: { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[r.starRating as string] ?? 0,
        text: r.comment ?? "",
        author: r.reviewer?.displayName ?? "Google user",
        createdAt: r.createTime,
        reply: r.reviewReply?.comment ?? null,
      }));
      return { output: reviews, quantity: 1, costMicros: 0 };
    }
    if (capability === "profile.insights") {
      const day = yesterday();
      const res = await fetch(`https://businessprofileperformance.googleapis.com/v1/${externalId}:fetchMultiDailyMetricsTimeSeries`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          dailyMetrics: INSIGHT_METRICS,
          dailyRange: { startDate: day, endDate: day },
        }),
      });
      if (!res.ok) throw new AppError(502, "provider_error", `Google returned ${res.status}`);
      return { output: insightsFrom(await res.json()), quantity: 1, costMicros: 0 };
    }
    throw new AppError(501, "not_implemented", `${capability} is not implemented live yet.`);
  },
};

/** The Performance API metrics we read, and which insight each one feeds. */
export const INSIGHT_METRICS = [
  "CALL_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
];

export function yesterday(now = new Date()): { year: number; month: number; day: number } {
  const d = new Date(now.getTime() - 86_400_000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Sums each metric's dated values into the three insights the app shows. */
export function insightsFrom(json: unknown): { calls: number; directions: number; searches: number } {
  const out = { calls: 0, directions: 0, searches: 0 };
  const series = (
    (
      json as {
        multiDailyMetricTimeSeries?: {
          dailyMetricTimeSeries?: { dailyMetric: string; timeSeries?: { datedValues?: { value?: string }[] } }[];
        }[];
      }
    ).multiDailyMetricTimeSeries ?? []
  ).flatMap((m) => m.dailyMetricTimeSeries ?? []);
  for (const s of series) {
    const total = (s.timeSeries?.datedValues ?? []).reduce((n, v) => n + Number(v.value ?? 0), 0);
    if (s.dailyMetric === "CALL_CLICKS") out.calls += total;
    else if (s.dailyMetric === "BUSINESS_DIRECTION_REQUESTS") out.directions += total;
    else if (s.dailyMetric.startsWith("BUSINESS_IMPRESSIONS_")) out.searches += total;
  }
  return out;
}

import { describe, expect, test } from "bun:test";
import { googleAccessToken } from "../src/adapters/gbp";

const env = { clientId: "client-id", clientSecret: "client-secret" };

const refused = async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });

describe("Google Business Profile access (refresh, not a stale token)", () => {
  test("exchanges the refresh token for a new access token, sending the right form", async () => {
    let sent: { url: string; body: string } | null = null;
    const fake = async (url: string, init?: RequestInit) => {
      sent = { url, body: String(init?.body) };
      return new Response(JSON.stringify({ access_token: "fresh-token" }), { status: 200 });
    };
    const token = await googleAccessToken({ refreshToken: "refresh-1", accessToken: "old" }, env, fake as never);
    expect(token).toBe("fresh-token");
    expect(sent!.url).toBe("https://oauth2.googleapis.com/token");
    const form = new URLSearchParams(sent!.body);
    expect(form.get("grant_type")).toBe("refresh_token");
    expect(form.get("refresh_token")).toBe("refresh-1");
    expect(form.get("client_id")).toBe("client-id");
  });

  test("without a refresh token, the stored access token is used as it is", async () => {
    expect(await googleAccessToken({ accessToken: "as-is" }, env)).toBe("as-is");
  });

  test("a refused refresh is an error, not a silent empty token", async () => {
    const fake = refused;
    await expect(googleAccessToken({ refreshToken: "revoked" }, env, fake as never)).rejects.toMatchObject({ status: 502 });
  });

  test("refreshing needs the Google client configured", async () => {
    await expect(googleAccessToken({ refreshToken: "r" }, {})).rejects.toMatchObject({ status: 503 });
  });
});

import { insightsFrom, yesterday } from "../src/adapters/gbp";

describe("Business Profile insights from the Performance API (shape)", () => {
  test("sums each metric's daily values into calls, directions and searches", () => {
    const json = {
      multiDailyMetricTimeSeries: [
        {
          dailyMetricTimeSeries: [
            { dailyMetric: "CALL_CLICKS", timeSeries: { datedValues: [{ value: "4" }, { value: "2" }] } },
            { dailyMetric: "BUSINESS_DIRECTION_REQUESTS", timeSeries: { datedValues: [{ value: "9" }] } },
            { dailyMetric: "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH", timeSeries: { datedValues: [{ value: "100" }] } },
            { dailyMetric: "BUSINESS_IMPRESSIONS_MOBILE_SEARCH", timeSeries: { datedValues: [{ value: "50" }] } },
          ],
        },
      ],
    };
    expect(insightsFrom(json)).toEqual({ calls: 6, directions: 9, searches: 150 });
  });

  test("an empty response is zeros, not an error", () => {
    expect(insightsFrom({})).toEqual({ calls: 0, directions: 0, searches: 0 });
  });

  test("the range is yesterday, in UTC", () => {
    expect(yesterday(new Date("2026-11-02T10:00:00Z"))).toEqual({ year: 2026, month: 11, day: 1 });
  });
});

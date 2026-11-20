import { describe, expect, test } from "bun:test";
import { nextRunAfter } from "../src/cadence";

describe("schedule cadence (UTC)", () => {
  const from = new Date("2026-11-02T10:30:00Z");

  test("hourly and 6h add a fixed interval", () => {
    expect(nextRunAfter("hourly", null, from).toISOString()).toBe("2026-11-02T11:30:00.000Z");
    expect(nextRunAfter("6h", null, from).toISOString()).toBe("2026-11-02T16:30:00.000Z");
  });

  test("daily at a fixed time lands on that time the next day", () => {
    expect(nextRunAfter("daily", "06:00", from).toISOString()).toBe("2026-11-03T06:00:00.000Z");
  });

  test("weekly and monthly use their own step", () => {
    expect(nextRunAfter("weekly", null, from).toISOString()).toBe("2026-11-09T10:30:00.000Z");
    expect(nextRunAfter("monthly", null, from).toISOString()).toBe("2026-12-02T10:30:00.000Z");
  });
});

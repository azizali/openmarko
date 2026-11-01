// When a schedule runs next. Times are UTC for now; per-Organization timezones come later (schema.md).
export type Every = "hourly" | "6h" | "daily" | "3d" | "weekly" | "monthly";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function nextRunAfter(every: Every, at: string | null | undefined, from: Date): Date {
  switch (every) {
    case "hourly":
      return new Date(from.getTime() + HOUR);
    case "6h":
      return new Date(from.getTime() + 6 * HOUR);
    case "3d":
      return atTime(new Date(from.getTime() + 3 * DAY), at);
    case "weekly":
      return atTime(new Date(from.getTime() + 7 * DAY), at);
    case "monthly":
      return atTime(new Date(from.getTime() + 30 * DAY), at);
    case "daily":
    default:
      return atTime(new Date(from.getTime() + DAY), at);
  }
}

function atTime(d: Date, at: string | null | undefined): Date {
  if (!at || !/^\d{2}:\d{2}$/.test(at)) return d;
  const [h, m] = at.split(":").map(Number) as [number, number];
  const out = new Date(d);
  out.setUTCHours(h, m, 0, 0);
  return out;
}

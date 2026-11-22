// Weekly series for the "last 90 days" charts: one value per week, from whatever checks ran that week.

const WEEK_MS = 7 * 86_400_000;
export const WEEKS = 13;

/** Monday 00:00 UTC of the week a time falls in. */
const weekStart = (t: number) => {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
};

export type Series = { labels: string[]; values: (number | null)[] };

/** Labels for the last 13 weeks, oldest first ("Nov 16"). */
export function weekLabels(now = Date.now()): { starts: number[]; labels: string[] } {
  const last = weekStart(now);
  const starts = Array.from({ length: WEEKS }, (_, i) => last - (WEEKS - 1 - i) * WEEK_MS);
  return {
    starts,
    labels: starts.map((s) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })),
  };
}

/**
 * One value per week: for each key, its newest reading in the week, combined across keys. A week with no readings
 * carries the last known value forward; weeks before the first reading are null.
 */
export function weekly(rows: { at: Date; key: string; value: number }[], combine: (xs: number[]) => number, now = Date.now()): Series {
  const { starts, labels } = weekLabels(now);
  const values: (number | null)[] = [];
  let carry: number | null = null;
  for (const start of starts) {
    const inWeek = rows.filter((r) => r.at.getTime() >= start && r.at.getTime() < start + WEEK_MS);
    const newest = new Map<string, { at: number; value: number }>();
    for (const r of inWeek) {
      const held = newest.get(r.key);
      if (!held || held.at < r.at.getTime()) newest.set(r.key, { at: r.at.getTime(), value: r.value });
    }
    if (newest.size) carry = combine([...newest.values()].map((v) => v.value));
    values.push(carry);
  }
  return { labels, values };
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: number[]) => (xs.length ? Math.round((sum(xs) / xs.length) * 10) / 10 : 0);

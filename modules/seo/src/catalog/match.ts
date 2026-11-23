// Typed text against a list: what the autocompletes on Setup (categories, cities) offer.

/**
 * The items containing every word typed, best first: those that start with it, then those `boost` prefers, then the
 * order the list came in (lists arrive most popular first, so that is the order they stay in).
 */
export function rankMatches<T>(
  items: readonly T[],
  typed: string,
  text: (item: T) => string,
  opts: { limit?: number; boost?: (item: T) => number } = {},
): T[] {
  const t = typed.trim().toLowerCase();
  if (!t) return [];
  const parts = t.split(/\s+/);
  const score = (x: T) => Number(text(x).toLowerCase().startsWith(t)) * 2 + (opts.boost?.(x) ?? 0);
  return items
    .filter((x) => parts.every((p) => text(x).toLowerCase().includes(p)))
    .sort((a, b) => score(b) - score(a))
    .slice(0, opts.limit ?? 10);
}

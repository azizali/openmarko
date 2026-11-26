// Shared by the reference lists we keep from a provider (Google's categories, its places): fetched when missing or a
// month old, replaced whole, and left as they were when a refresh fails. Each list says how to ask and how to store.

const MONTH_MS = 30 * 24 * 3600 * 1000;

export type Stored = { n: number; newest: Date | string | null };

/**
 * Fetches a list again when what's stored is missing or stale. Returns the new rows once stored, or null when the
 * stored list is still good (or a refresh failed with something stored to fall back on). With nothing stored, a failed
 * fetch is thrown, so the screen can say why.
 */
export async function refreshStale<T>(
  stored: Stored,
  fetch: () => Promise<T[]>,
  replace: (rows: T[]) => Promise<void>,
): Promise<T[] | null> {
  const age = stored.newest ? Date.now() - new Date(stored.newest).getTime() : Infinity;
  if (stored.n && age <= MONTH_MS) return null;
  let rows: T[];
  try {
    rows = await fetch();
  } catch (e) {
    if (!stored.n) throw e;
    return null;
  }
  if (!rows.length) return null;
  await replace(rows);
  return rows;
}

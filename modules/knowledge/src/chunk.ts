// Cutting text into chunks for embedding (S1.6). About 600 tokens each, cut at paragraph, then sentence, ends where
// possible, with some overlap so an answer that spans a cut is still found.
const TARGET_CHARS = 2400;
const OVERLAP_CHARS = 300;
export const MAX_CHUNKS = 2000;

export const tokensOf = (s: string) => Math.max(1, Math.ceil(s.length / 4));

/** Splits long text into pieces no longer than `max`, at the last paragraph or sentence end before it. */
function pieces(text: string, max: number): string[] {
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    let cut = window.lastIndexOf("\n\n");
    if (cut < max * 0.5) cut = Math.max(window.lastIndexOf(". "), window.lastIndexOf("\n"));
    if (cut < max * 0.5) cut = window.lastIndexOf(" ");
    if (cut <= 0) cut = max;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(Math.max(1, cut + 1 - OVERLAP_CHARS));
  }
  if (rest.trim()) out.push(rest.trim());
  return out;
}

export function chunkText(text: string): string[] {
  const clean = text.trim();
  if (!clean) return [];
  return pieces(clean, TARGET_CHARS).filter((c) => c.length > 0);
}

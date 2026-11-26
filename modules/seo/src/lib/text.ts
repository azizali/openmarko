// Words: how keywords and questions are kept, and how a business is recognised in an AI answer. Pure functions.

/** A keyword as it's stored and compared: lower case, single spaces. */
export const normalizeTerm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** A question as it's stored: single spaces, first letter capital, ends with a question mark. */
export function normalizeQuestion(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (!t) return t;
  const q = t[0]!.toUpperCase() + t.slice(1);
  return /[?.!]$/.test(q) ? q.replace(/[.!]$/, "?") : `${q}?`;
}

/** A short phrase reads as a keyword, not a question: the add form says so. */
export const looksLikeKeyword = (s: string) => !/[?]/.test(s) && s.trim().split(/\s+/).length <= 4;

const fold = (s: string) =>
  ` ${s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;

/** Words a business name carries that don't tell it apart (a legal suffix, "the"). */
const filler = new Set(["the", "and", "co", "inc", "llc", "ltd", "pllc", "pc", "of"]);

/**
 * The forms of a name worth looking for in text: the whole name, and the name without its filler words. A form
 * must keep at least two words or six letters, so "Smile" alone never matches.
 */
export function nameForms(name: string): string[] {
  const whole = fold(name).trim();
  const core = whole
    .split(" ")
    .filter((w) => !filler.has(w))
    .join(" ");
  return [...new Set([whole, core])].filter((f) => f.includes(" ") || f.length >= 6);
}

/**
 * The businesses an answer names, in the order it first names them. `candidates` are the businesses it could
 * name (those seen nearby); anyone else isn't recognised.
 */
export function mentionsIn<T extends { name: string }>(text: string, candidates: T[]): T[] {
  const hay = fold(text);
  const found: { c: T; at: number }[] = [];
  for (const c of candidates) {
    const at = Math.min(
      ...nameForms(c.name)
        .map((f) => hay.indexOf(` ${f} `))
        .filter((i) => i >= 0),
    );
    if (Number.isFinite(at)) found.push({ c, at });
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.c);
}

/** The opening of an answer, cut at a sentence or a word near `max` characters. */
export function excerptOf(text: string, max = 280): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sentence = cut.lastIndexOf(". ");
  if (sentence > max * 0.6) return cut.slice(0, sentence + 1);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

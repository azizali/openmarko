// What the product mocks on the home page show: one dental practice on South Congress, Austin, the same stub market
// the app runs on before live keys are connected. Fixed numbers, so every visit draws the same picture.

export const business = { name: "Bright Smile Dental", area: "South Congress, Austin" };

/** Top-3 spots over the last 12 weeks for the first keyword: the climb since the categories were fixed. */
export const history = [9, 9, 10, 11, 11, 13, 14, 15, 17, 19, 20, 21];

/** Rank colours, the same thresholds as the app's grid: top 3 green, top 10 amber, below that red, unranked grey. */
export const rankFill = (r: number | null) =>
  r === null ? "var(--subtle)" : r <= 3 ? "var(--good)" : r <= 10 ? "var(--warn)" : "var(--bad)";

/**
 * A size × size grid of positions around the door (the middle spot). Strong near the door, weaker with distance,
 * weakest across the river to the north-east, where a competitor sits. Past 20 is "not found" (null).
 */
export function gridRanks(size: number, seed = 0): (number | null)[] {
  const c = (size - 1) / 2;
  const out: (number | null)[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const d = Math.hypot(row - c, col - c) / c; // 0 at the door, about 1.4 in a corner
      const wobble = (((row * 7 + col * 13 + seed * 5) % 5) - 2) * 0.7;
      const rival = row < c && col > c ? 6 * d : 0;
      const r = Math.max(1, Math.round(1 + d * (3 + seed * 0.8) + wobble + rival));
      out.push(r > 20 ? null : r);
    }
  }
  return out;
}

export const top3 = (ranks: (number | null)[]) => ranks.filter((r) => r !== null && r <= 3).length;

export const mapsKeywords = [
  { keyword: "dentist", seed: 0, change: 6 },
  { keyword: "emergency dentist", seed: 2, change: 3 },
  { keyword: "teeth whitening", seed: 4, change: -2 },
  { keyword: "invisalign", seed: 1, change: 0 },
  { keyword: "pediatric dentist", seed: 3, change: 4 },
];

export const searchKeywords = [
  { keyword: "dentist south congress austin", position: 2, change: 3, pack: true, overview: true },
  { keyword: "best dentist in austin", position: 7, change: 2, pack: true, overview: false },
  { keyword: "emergency dentist austin", position: 4, change: 0, pack: true, overview: true },
  { keyword: "teeth whitening austin", position: 12, change: -3, pack: false, overview: false },
  { keyword: "invisalign austin tx", position: 9, change: 1, pack: false, overview: true },
];

export const competitors = [
  { name: "Congress Ave Dental", ahead: 9, rating: 4.9, reviews: 312 },
  { name: "Bouldin Creek Smiles", ahead: 5, rating: 4.8, reviews: 201 },
  { name: "SoCo Family Dentistry", ahead: 3, rating: 4.6, reviews: 164 },
  { name: "Travis Heights Dental", ahead: 1, rating: 4.7, reviews: 88 },
];

export const engines = [
  { id: "chatgpt", name: "ChatGPT", icon: "/icons/openai.svg", ink: true },
  { id: "overview", name: "AI Overview", icon: "/icons/gemini.svg", ink: false },
  { id: "perplexity", name: "Perplexity", icon: "/icons/perplexity.svg", ink: false },
] as const;

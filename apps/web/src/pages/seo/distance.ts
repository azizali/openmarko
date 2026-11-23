// Distances as the app shows them: in miles, never kilometres. The grid's reach is stored in metres (what the search
// provider takes); everything a person reads goes through here.

/** Google Maps is searched from a 7 × 7 grid: one spot on the business's door, three rings around it. */
export const GRID_SIZE = 7;
export const GRID_SPOTS = GRID_SIZE * GRID_SIZE;

const M_PER_MILE = 1609.344;

/** "0.7 mi", "2 mi", "12 mi": one decimal under ten, none past it, no trailing ".0". */
export function miles(metres: number): string {
  const mi = metres / M_PER_MILE;
  const text = mi < 10 ? mi.toFixed(1).replace(/\.0$/, "") : String(Math.round(mi));
  return `${text} mi`;
}

/** The distance between two neighbouring spots of a grid that reaches `radiusM` from its centre each way. */
export const spacingM = (radiusM: number, size = GRID_SIZE) => radiusM / Math.max(1, (size - 1) / 2);

/** The grid's area in a phrase: "a 4 × 4 mi area". */
export const gridArea = (radiusM: number) => {
  const side = miles(radiusM * 2).replace(" mi", "");
  return `a ${side} × ${side} mi area`;
};

/** What the grid covers, in a sentence: "Covers a 4 × 4 mi area: 2 mi from the business each way, spots 0.7 mi apart." */
export function gridCoverage(radiusM: number, size = GRID_SIZE): string {
  return `Covers ${gridArea(radiusM)}: ${miles(radiusM)} from the business each way, spots ${miles(spacingM(radiusM, size))} apart.`;
}

/** How far the grid can reach, in miles: a dense city wants it tight, a business that drives to customers wants it wide. */
export const reaches = [0.5, 1, 2, 3, 5, 10];
export const metresOf = (mi: number) => Math.round(mi * M_PER_MILE);
/** The preset nearest a stored reach, so one set elsewhere still shows as picked. */
export const nearestReach = (m: number) =>
  metresOf(reaches.reduce((a, b) => (Math.abs(metresOf(b) - m) < Math.abs(metresOf(a) - m) ? b : a)));

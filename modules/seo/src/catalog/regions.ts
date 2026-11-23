// US states: the full name Google's place paths use ("Texas"), the two letters people write ("TX"). Places in the US are
// shown with the letters ("Austin, TX"); elsewhere the region is shown as the provider names it.

const states: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  "District of Columbia": "DC",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
};
const byLetters = new Map(Object.entries(states).map(([name, letters]) => [letters, name]));

/** How a region is shown in a place's label: US states by their letters, anything else as it is. */
export const regionLabel = (countryCode: string, region: string) => (countryCode === "US" ? (states[region] ?? region) : region);

/** The full region name for what an address says ("TX" in "Austin, TX 78701, USA" is "Texas"), when it says one. */
export function regionOfAddress(countryCode: string, address: string | null | undefined): string | null {
  if (countryCode !== "US" || !address) return null;
  const letters = /,\s*([A-Z]{2})(?:\s+\d{5})?(?:,|$)/.exec(address)?.[1];
  return (letters && byLetters.get(letters)) || null;
}

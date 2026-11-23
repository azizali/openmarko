// `places.find` through the Places API (New) Text Search: a business by its name or address. The stub offers the
// businesses of the stub market (stub-world.ts).

import { AppError } from "@app/kernel";
import type { Adapter } from "../types";
import type { PlaceCandidate, PlacesInput } from "../search/contract";
import { stubPlaces } from "../search/stub-world";

/** Text Search with contact and rating fields (Enterprise SKU): $35 per 1,000 requests. */
const COST_MICROS = 35_000;

const FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.primaryTypeDisplayName",
  "places.rating",
  "places.userRatingCount",
  "places.addressComponents",
  "places.timeZone",
].join(",");

type ApiPlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  websiteUri?: string;
  nationalPhoneNumber?: string;
  primaryTypeDisplayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  addressComponents?: { shortText?: string; longText?: string; types?: string[] }[];
  timeZone?: { id?: string };
};

const component = (p: ApiPlace, type: string, short = false) => {
  const c = p.addressComponents?.find((x) => x.types?.includes(type));
  return (short ? c?.shortText : c?.longText) ?? null;
};

function toCandidate(p: ApiPlace): PlaceCandidate | null {
  if (!p.id || !p.location) return null;
  return {
    placeId: p.id,
    name: p.displayName?.text ?? "Unnamed business",
    address: p.formattedAddress ?? "",
    lat: p.location.latitude,
    lng: p.location.longitude,
    countryCode: component(p, "country", true),
    city: component(p, "locality"),
    timezone: p.timeZone?.id ?? null,
    website: p.websiteUri ?? null,
    phone: p.nationalPhoneNumber ?? null,
    category: p.primaryTypeDisplayName?.text ?? null,
    rating: p.rating ?? null,
    reviewCount: p.userRatingCount ?? null,
  };
}

export const googlePlaces: Adapter = {
  provider: "google_places",
  capabilities: ["places.find"],
  call: async (_capability, input, c) => {
    const { query, near } = input as PlacesInput;
    if (!query?.trim()) throw new AppError(422, "invalid", "Type a business name or address.");
    if (c.mode === "stub") return { output: { places: stubPlaces(query, near) }, quantity: 1, costMicros: COST_MICROS };
    const { apiKey } = await c.secrets();
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey ?? "", "x-goog-fieldmask": FIELDS },
      body: JSON.stringify({
        textQuery: query,
        pageSize: 5,
        ...(near ? { locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 50_000 } } } : {}),
      }),
    });
    if (!res.ok) {
      // Google explains a refusal (key restricted, API not enabled, billing off) in `error.message`.
      const reason = ((await res.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message;
      throw new AppError(502, "provider_failed", `Google Places answered ${res.status}${reason ? `: ${reason}` : "."}`);
    }
    const json = (await res.json()) as { places?: ApiPlace[] };
    const places = (json.places ?? []).map(toCandidate).filter((p): p is PlaceCandidate => !!p);
    return { output: { places }, quantity: 1, costMicros: COST_MICROS };
  },
};

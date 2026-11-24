// The SEO pages' calls to the API, and the shapes they return (inferred from the API's own types, so a change there
// is a type error here). Every page reads through these; none builds a path by hand.
import { api } from "../../lib/api";

export const seoApi = (orgId: string) => api.api.v1.organizations({ orgId }).seo;
export const locationApi = (orgId: string, locationId: string) => seoApi(orgId).locations({ locationId });

type Data<F extends (...args: never[]) => Promise<{ data: unknown }>> = NonNullable<Awaited<ReturnType<F>>["data"]>;
type L = ReturnType<typeof locationApi>;

export type LocationView = Data<ReturnType<typeof seoApi>["locations"]["get"]>[number];
export type Overview = Data<L["overview"]["get"]>;
export type CheckStatus = Data<L["checks"]["get"]>;
export type MapsSummary = Data<L["results"]["maps"]["get"]>;
export type KeyPagesView = Data<L["results"]["key-pages"]["get"]>;
export type MapsKeyword = Data<ReturnType<L["results"]["maps"]>["get"]>;
export type PlaceInsight = Data<ReturnType<L["places"]>["get"]>;
export type SearchPage = Data<L["results"]["search"]["get"]>;
export type AiPage = Data<L["results"]["ai"]["get"]>;
export type CompetitorsPage = Data<L["results"]["competitors"]["get"]>;
export type Suggestions = Data<L["suggestions"]["get"]>;
export type Suggestion = Suggestions["open"][number];
export type Ideas = Data<L["ideas"]["get"]>;
export type Details = Data<L["details"]["get"]>;
export type Place = Data<ReturnType<typeof seoApi>["find"]["post"]>[number];
export type Limits = Data<ReturnType<typeof seoApi>["limits"]["get"]>;
export type Channel = "maps" | "google" | "ai";
export type Engine = "chatgpt" | "google_ai" | "perplexity";

export const engineNames: Record<string, string> = { chatgpt: "ChatGPT", google_ai: "Google AI", perplexity: "Perplexity" };

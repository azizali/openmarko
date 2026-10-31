// The Partner: an agency (or consultant, or reseller) that manages Organizations
// for its Clients and puts its own brand on the app for them. One level above
// Organization. Each Organization belongs to at most one Partner and can
// transfer out, keeping its data.

import { member } from "./mock";

export type PartnerRole = "Admin" | "Member";
export type Partner = {
  id: string;
  name: string;
  /** Picks the fallback address, {slug}.openmarko.com, which always works even if the custom domain doesn't. */
  slug: string;
  /** The signed-in Member's role on the Partner. Only Admins change whitelabel and Clients. */
  role: PartnerRole;
};

/** The Partner the signed-in Member works for, if any. Agency-plan Members belong to one. */
export const partner: Partner | null = member.plan === "agency"
  ? { id: "ptn_brightline", name: "Brightline Local", slug: "brightline", role: "Admin" }
  : null;

export const fallbackHost = (p: Partner) => `${p.slug}.openmarko.com`;

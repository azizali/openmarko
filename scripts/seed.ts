// Development data: the Maple & Main and Brightline examples from the mock. Not for production.
// Idempotent: running it again changes nothing once the organizations exist.
import { createAppContext, loadConfig, type AppContext } from "@openmarko/kernel";
import { authFor } from "@openmarko/identity";
import { compose } from "@openmarko/platform";
import { addMember, addWebsite, createLocation, requestClient, respondToPartnerRequest } from "@openmarko/organizations";
import { assignPlanManually, upsertPlan } from "@openmarko/billing";
import { connect } from "@openmarko/integrations";
import { authOrganization } from "@openmarko/kernel";
import { and, eq, sql } from "drizzle-orm";

if (process.env.NODE_ENV === "production") throw new Error("seed.ts is for development only.");

const cfg = loadConfig();
const ctx: AppContext = createAppContext(cfg);
compose(ctx);
const password = process.env.SEED_PASSWORD ?? "password-123";

async function person(email: string, name: string): Promise<string> {
  const auth = authFor(ctx);
  try {
    const r = await auth.api.signUpEmail({ body: { email, password, name } });
    return r.user.id;
  } catch {
    const rows = await ctx.db.execute(sql`select id from auth."user" where email = ${email}`);
    return (rows.rows[0] as { id: string }).id;
  }
}

async function signedIn(email: string) {
  const si = await authFor(ctx).api.signInEmail({ body: { email, password }, returnHeaders: true });
  return new Headers({
    cookie: si.headers
      .getSetCookie()
      .map((c: string) => c.split(";")[0])
      .join("; "),
  });
}

async function ensureOrg(slug: string, name: string, ownerEmail: string, category: string) {
  const [existing] = await ctx.db.select().from(authOrganization).where(eq(authOrganization.slug, slug));
  if (existing) return existing.id;
  const userId = await person(ownerEmail, name);
  const headers = await signedIn(ownerEmail);
  const org = await authFor(ctx).api.createOrganization({ body: { name, slug, category, timezone: "America/Chicago" }, headers });
  void userId;
  return (org as { id: string }).id;
}

const ownerOf = async (orgId: string): Promise<string> => {
  const rows = await ctx.db.execute(sql`select "userId" from auth.member where "organizationId" = ${orgId} and role = 'owner' limit 1`);
  return (rows.rows[0] as { userId: string }).userId;
};

const maple = await ensureOrg("maple-and-main-dental", "Maple & Main Dental", "owner@maple.test", "Dentist");
const mapleFresh = (await ctx.db.select().from(authOrganization).where(eq(authOrganization.id, maple)))[0];
const hasLocations = (await ctx.db.execute(sql`select 1 from core.locations where organization_id = ${maple} limit 1`)).rows.length > 0;
if (mapleFresh && !hasLocations) {
  const mapleUser = await ownerOf(maple);
  const actor = { orgId: maple, userId: mapleUser };
  await upsertPlan(ctx, {
    id: "dev-local",
    name: "Local (development)",
    entitlements: {
      "feature.seo": 1,
      "feature.rankings": 1,
      "feature.reviews": 1,
      "feature.ai_answers": 1,
      "feature.site_health": 1,
      "feature.citations": 1,
      "feature.content": 1,
      "limit.locations": 5,
    },
    meters: [
      { meter: "dataforseo.request", included: null, overage: "charge", unitPriceMicros: 0 },
      { meter: "llm.tokens", included: null, overage: "charge", unitPriceMicros: 0 },
      { meter: "email.sent", included: 100, overage: "block" },
    ],
  });
  await assignPlanManually(ctx, maple, "dev-local", mapleUser);
  const south = await createLocation(ctx, actor, {
    name: "Maple & Main — South Congress",
    city: "Austin",
    region: "TX",
    lat: 30.2481,
    lng: -97.747,
    placeId: "ChIJ-maple-south-congress",
    websiteUrl: "https://mapleandmain.com/implants",
  });
  await createLocation(ctx, actor, {
    name: "Maple & Main — Mueller",
    city: "Austin",
    region: "TX",
    lat: 30.2985,
    lng: -97.7025,
    placeId: "ChIJ-maple-mueller",
  });
  await addWebsite(ctx, actor, "mapleandmain.com");
  await connect(ctx, {
    organizationId: null,
    providerId: "platform_llm",
    target: { type: "platform", id: null },
    label: "Platform default",
    secrets: { apiKey: process.env.PLATFORM_LLM_KEY ?? "dev-key", vendor: "anthropic" },
  }).catch(() => undefined);
  await connect(ctx, {
    organizationId: maple,
    providerId: "dataforseo",
    target: { type: "organization", id: maple },
    label: "DataForSEO (stub)",
    secrets: { login: "dev", password: "dev" },
  });
  await connect(ctx, {
    organizationId: maple,
    providerId: "gbp",
    target: { type: "location", id: south },
    externalId: "locations/maple-south-congress",
    label: "Maple & Main — South Congress",
    createdBy: mapleUser,
  }).catch(() => undefined);
  await ctx.db.execute(sql`update core.locations set gbp_id = 'locations/maple-south-congress' where id = ${south}`);
  console.log(`seeded ${maple} (Maple & Main Dental), owner owner@maple.test`);
}

const brightline = await ensureOrg("brightline-local", "Brightline Local", "owner@brightline.test", "Agency");
const brightlineOwner = await ownerOf(brightline);
await upsertPlan(ctx, {
  id: "dev-agency",
  name: "Agency (development)",
  entitlements: {
    partner: 1,
    "feature.seo": 1,
    "feature.rankings": 1,
    "feature.reviews": 1,
    "feature.site_health": 1,
    "feature.citations": 1,
    "feature.content": 1,
  },
});
await assignPlanManually(ctx, brightline, "dev-agency", brightlineOwner);
const { partnerRequests } = await import("@openmarko/organizations/schema");
const existingReq = await ctx.db
  .select()
  .from(partnerRequests)
  .where(and(eq(partnerRequests.partnerId, brightline)));
if (existingReq.length === 0) {
  const mapleOwner = await ownerOf(maple);
  const reqId = await requestClient(ctx, { orgId: brightline, userId: brightlineOwner }, maple);
  await respondToPartnerRequest(ctx, { orgId: maple, userId: mapleOwner }, reqId, true);
  await addMember(ctx, brightline, brightlineOwner, "owner");
}
console.log("seed done. Sign in as owner@maple.test or owner@brightline.test with password", password);
await ctx.pool.end();

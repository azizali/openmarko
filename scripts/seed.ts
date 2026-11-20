// Development data: an admin, two Organizations (one a Partner of the other), a Plan, and stub Connections, so
// every screen has something to show. Not for production. Idempotent: running it again changes nothing.
import { eq } from "drizzle-orm";
import { appConfig, authOrganization, authUser, createAppContext, loadConfig, moduleOn, type AppContext } from "@app/kernel";
import { authOf } from "@app/identity";
import { compose } from "@app/server";
import { addMember } from "@app/organizations";
import { connect } from "@app/integrations";
import { readAppSetting, writeAppSetting } from "@app/settings";

if (process.env.NODE_ENV === "production") throw new Error("seed.ts is for development only.");

const cfg = loadConfig();
const ctx: AppContext = createAppContext(cfg);
compose(ctx);
ctx.enqueue = async () => {}; // nothing runs jobs here
const auth = authOf(ctx);
const password = process.env.SEED_PASSWORD ?? "password-123";

async function person(email: string, name: string, admin = false): Promise<string> {
  const [existing] = await ctx.db.select({ id: authUser.id }).from(authUser).where(eq(authUser.email, email));
  if (existing) return existing.id;
  const r = await auth.api.signUpEmail({ body: { email, password, name } });
  if (admin) await ctx.db.update(authUser).set({ role: "admin", emailVerified: true }).where(eq(authUser.id, r.user.id));
  else await ctx.db.update(authUser).set({ emailVerified: true }).where(eq(authUser.id, r.user.id));
  return r.user.id;
}

async function signedIn(email: string) {
  const si = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
  return new Headers({
    cookie: si.headers
      .getSetCookie()
      .map((c: string) => c.split(";")[0])
      .join("; "),
    origin: cfg.appUrl,
  });
}

async function ensureOrg(slug: string, name: string, ownerEmail: string) {
  const [existing] = await ctx.db.select().from(authOrganization).where(eq(authOrganization.slug, slug));
  if (existing) return existing.id;
  await person(ownerEmail, name.split(" ")[0] ?? name);
  const org = await auth.api.createOrganization({ body: { name, slug, timezone: "America/Chicago" }, headers: await signedIn(ownerEmail) });
  return (org as { id: string }).id;
}

// The first app admin. ADMIN_EMAILS in .env does the same for your own address.
const adminId = await person("admin@example.test", "App Admin", true);

const acme = await ensureOrg("acme", "Acme Inc.", "owner@example.test");
await person("owner@example.test", "Owner");
await person("member@example.test", "Member");
const memberId = (await ctx.db.select({ id: authUser.id }).from(authUser).where(eq(authUser.email, "member@example.test")))[0]!.id;
await addMember(ctx, acme, memberId, "editor");
// The admin is also a member of Acme, so the app shell opens straight away for them.
await addMember(ctx, acme, adminId, "admin");

if (moduleOn(ctx, "billing")) {
  const { ensureFirstPlan, upsertPlan } = await import("@app/billing");
  await ensureFirstPlan(ctx);
  await upsertPlan(ctx, {
    id: "pro",
    name: "Pro",
    description: "Higher limits and overage billing.",
    sort: 1,
    entitlements: Object.fromEntries(appConfig.features.map((f) => [`feature.${f.id}`, 1])),
    meters: [
      { meter: "llm.tokens", included: 2_000_000, overage: "charge", unitPriceMicros: 3 },
      { meter: "email.sent", included: 5000, overage: "charge", unitPriceMicros: 500 },
    ],
    prices: [{ interval: "month", amountCents: 4900 }],
  });
  await upsertPlan(ctx, {
    id: "partner",
    name: "Partner",
    description: "For Partners managing Client Organizations.",
    sort: 2,
    entitlements: { partner: 1, ...Object.fromEntries(appConfig.features.map((f) => [`feature.${f.id}`, 1])) },
    meters: [{ meter: "llm.tokens", included: null, overage: "charge", unitPriceMicros: 3 }],
    prices: [{ interval: "month", amountCents: 19900 }],
  });
}

if (moduleOn(ctx, "partners")) {
  const brightline = await ensureOrg("brightline", "Brightline Partners", "partner@example.test");
  const partnerOwner = await person("partner@example.test", "Partner");
  if (moduleOn(ctx, "billing")) {
    const { assignPlanManually } = await import("@app/billing");
    await assignPlanManually(ctx, brightline, "partner", adminId);
  }
  const { setBrand } = await import("@app/partners");
  const [client] = await ctx.db
    .select({ partnerId: authOrganization.partnerId })
    .from(authOrganization)
    .where(eq(authOrganization.id, acme));
  if (!client?.partnerId) {
    await ctx.db.update(authOrganization).set({ partnerId: brightline }).where(eq(authOrganization.id, acme));
    await addMember(ctx, acme, partnerOwner, "admin");
    await setBrand(ctx, brightline, { name: "Brightline", assistant: "Bright", accent: "#1d4ed8", logo: null }, partnerOwner);
  }
}

// The app's own accounts: Mailpit for email, and stub model keys, so sending and chat work without vendors.
const { listAppConnections } = await import("@app/integrations");
const have = new Set((await listAppConnections(ctx)).map((c) => c.providerId));
if (!have.has("smtp")) {
  await connect(ctx, {
    organizationId: null,
    providerId: "smtp",
    target: { type: "app", id: null },
    label: "Mailpit (development)",
    settings: { host: "localhost", port: "1025", secure: "no" },
    mode: "live", // Mailpit is on this machine, so development mail is really delivered to it
    createdBy: adminId,
  });
}
if (!have.has("anthropic")) {
  await connect(ctx, {
    organizationId: null,
    providerId: "anthropic",
    target: { type: "app", id: null },
    label: "Anthropic (stub key)",
    secrets: { apiKey: "stub" },
    createdBy: adminId,
  });
}
if (!have.has("openai")) {
  await connect(ctx, {
    organizationId: null,
    providerId: "openai",
    target: { type: "app", id: null },
    label: "OpenAI (stub key, embeddings)",
    secrets: { apiKey: "stub" },
    createdBy: adminId,
  });
}
// Only when unset, so running this again keeps what you've chosen since (a real default model, say).
if (!(await readAppSetting(ctx, "messaging")))
  await writeAppSetting(ctx, "messaging", { fromEmail: "hello@example.test", fromName: appConfig.name, replyTo: "" }, { by: adminId });
if (moduleOn(ctx, "ai") && !(await readAppSetting(ctx, "ai")))
  await writeAppSetting(ctx, "ai", { defaultModel: "fast", models: { fast: { model: "anthropic/claude-haiku-5-5" } } }, { by: adminId });

console.log(
  `seed done. Sign in at ${cfg.appUrl} as admin@example.test (app admin), owner@example.test, member@example.test or partner@example.test; password: ${password}`,
);
await ctx.pool.end();
process.exit(0);

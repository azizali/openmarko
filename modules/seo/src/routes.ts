// SEO's routes. Everything a Member does is under /api/v1/organizations/:orgId/seo and checks two things first: the
// Role allows the action (access.ts), and SEO is on for the Organization (feature, Plan and module). Two more:
//   GET /api/v1/seo/checks/:checkId/ready   the provider's pingback: a task is ready (signed, no session)
//   GET /api/v1/admin/seo/costs             what search data costs, for app admins

import { Elysia, t } from "elysia";
import { AppError, ids, invalid, safeEqual, type AppContext } from "@app/kernel";
import { requireAllowed, type Caller } from "@app/shared";
import { assertFeatureOn } from "@app/features";
import { FEATURE, planLimits, SEO, type SeoAction } from "./access";
import { costs } from "./admin/costs";
import { COLLECT_JOB, pingbackSignature, startCycle } from "./checks/cycle";
import { queueScopedCheck } from "./checks/jobs";
import { checkStatus, idleKinds, rankingKinds } from "./checks/status";
import { createLocation, getLocation, getLocationView, linkProfile, listLocations, setStatus, updateLocation } from "./locations/service";
import { detailsFor, findBusiness, ideasFor, launch, progressOf, searchCategories, searchCityList } from "./onboarding/service";
import { linkLocationProfile, profileLocations, syncProfileMetrics } from "./profile/service";
import { aiPage } from "./results/ai";
import { competitorsPage } from "./results/competitors";
import { keywordsPage } from "./results/keywords";
import { mapsKeyword, mapsSummary } from "./results/maps";
import { overview } from "./results/overview";
import { placeInsight } from "./results/place";
import { auditIssue, auditPage } from "./audit/results";
import { actionFor, applySuggestion, dismissSuggestion, listSuggestions, undoSuggestion } from "./suggestions/service";
import {
  addKeywords,
  addQuestions,
  listKeywords,
  listOverrides,
  listQuestions,
  removeKeyword,
  removeOverride,
  removeQuestion,
  setOverride,
} from "./tracking/service";

const place = t.Object({
  placeId: t.String({ minLength: 1 }),
  name: t.String({ minLength: 1, maxLength: 200 }),
  address: t.String({ maxLength: 300 }),
  lat: t.Number(),
  lng: t.Number(),
  countryCode: t.Nullable(t.String()),
  city: t.Nullable(t.String()),
  timezone: t.Nullable(t.String()),
  website: t.Nullable(t.String()),
  phone: t.Nullable(t.String()),
  category: t.Nullable(t.String()),
  rating: t.Nullable(t.Number()),
  reviewCount: t.Nullable(t.Number()),
});
const coordinates = t.Object({ lat: t.Number(), lng: t.Number() });
const every = t.Union([t.Literal("daily"), t.Literal("weekly"), t.Literal("monthly")]);
const engine = t.Union([t.Literal("chatgpt"), t.Literal("google_ai"), t.Literal("perplexity")]);
const source = t.Union([t.Literal("onboarding"), t.Literal("manual")]);
const status = t.Union([t.Literal("active"), t.Literal("paused"), t.Literal("archived")]);
const channel = t.Union([t.Literal("maps"), t.Literal("google"), t.Literal("ai")]);
const checkKind = t.Union([t.Literal("maps"), t.Literal("organic"), t.Literal("ai"), t.Literal("audit")]);
const overrideAction = t.Union([t.Literal("added"), t.Literal("hidden")]);

export function seoRoutes(ctx: AppContext) {
  /** The Role allows it, and SEO is on for this Organization. */
  const gate = async (caller: Caller, action: SeoAction) => {
    requireAllowed(caller, SEO, action);
    await assertFeatureOn(ctx, caller.orgId, FEATURE);
  };
  const loc = ids("locationId");
  const actor = (caller: Caller) => ({ organizationId: caller.orgId, userId: caller.userId, actorType: "member" as const });

  const member = new Elysia({ name: "seo" }).group("/api/v1/organizations/:orgId/seo", (g) =>
    g
      .use(ctx.orgGuard!)
      // ---------- Locations ----------
      .get(
        "/locations",
        async ({ caller }) => {
          await gate(caller, "view");
          return listLocations(ctx, caller.orgId);
        },
        { params: ids(), detail: { summary: "The Organization's Locations in SEO" } },
      )
      .post(
        "/locations",
        async ({ caller, body }) => {
          await gate(caller, "manage");
          return { id: await createLocation(ctx, caller.orgId, caller.userId, body) };
        },
        {
          params: ids(),
          body: t.Object({
            place: t.Optional(t.Nullable(place)),
            name: t.String({ minLength: 1, maxLength: 200 }),
            lat: t.Number(),
            lng: t.Number(),
            address: t.Optional(t.Nullable(t.String())),
            city: t.Optional(t.Nullable(t.String())),
            timezone: t.Optional(t.Nullable(t.String())),
            countryCode: t.Optional(t.Nullable(t.String({ minLength: 2, maxLength: 2 }))),
            website: t.Optional(t.Nullable(t.String())),
            services: t.Optional(t.Array(t.String({ maxLength: 80 }), { maxItems: 40 })),
          }),
          detail: { summary: "Add a Location as a draft (nothing is checked until it's launched)" },
        },
      )
      .get(
        "/locations/:locationId",
        async ({ caller, params }) => {
          await gate(caller, "view");
          return getLocationView(ctx, caller.orgId, params.locationId);
        },
        { params: loc, detail: { summary: "One Location" } },
      )
      .patch(
        "/locations/:locationId",
        async ({ caller, params, body }) => {
          await gate(caller, "manage");
          await updateLocation(ctx, caller.orgId, caller.userId, params.locationId, body);
          return getLocationView(ctx, caller.orgId, params.locationId);
        },
        {
          params: loc,
          body: t.Object({
            name: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
            website: t.Optional(t.Nullable(t.String())),
            services: t.Optional(t.Array(t.String({ maxLength: 80 }), { maxItems: 40 })),
            /** Google's categories and places to track, as picked at Setup. */
            categories: t.Optional(t.Array(t.String({ maxLength: 120 }), { maxItems: 10 })),
            cities: t.Optional(t.Array(t.String({ maxLength: 120 }), { maxItems: 10 })),
            gridSize: t.Optional(t.Number()),
            gridRadiusM: t.Optional(t.Number()),
            checkEvery: t.Optional(every),
            engines: t.Optional(t.Array(engine)),
          }),
          detail: { summary: "Change a Location: name, website, services, and how its checks run (within the Plan)" },
        },
      )
      .post(
        "/locations/:locationId/launch",
        async ({ caller, params }) => {
          await gate(caller, "manage");
          return launch(ctx, caller.orgId, caller.userId, params.locationId);
        },
        { params: loc, detail: { summary: "Start a Location's checks: the first one runs now" } },
      )
      .post(
        "/locations/:locationId/status",
        async ({ caller, params, body }) => {
          await gate(caller, "manage");
          await setStatus(ctx, caller.orgId, caller.userId, params.locationId, body.status);
          return { ok: true };
        },
        { params: loc, body: t.Object({ status }), detail: { summary: "Pause, resume or remove a Location" } },
      )
      .post(
        "/locations/:locationId/check",
        async ({ caller, params, body }) => {
          await gate(caller, "manage");
          const l = await getLocation(ctx, caller.orgId, params.locationId);
          if (l.status !== "active") throw new AppError(409, "conflict", "Start this location's checks first.");
          const kinds = await idleKinds(ctx, l.id, body.kinds ?? rankingKinds);
          if (!kinds.length) throw new AppError(409, "conflict", "Already checking. Results come in over the next few minutes.");
          const { runId } = await startCycle(ctx, caller.orgId, l.id, { queue: "standard", kinds, trigger: "manual", by: caller.userId });
          return { runId, kinds };
        },
        {
          params: loc,
          body: t.Object({ kinds: t.Optional(t.Array(checkKind, { minItems: 1, uniqueItems: true })) }),
          detail: {
            summary:
              "Check a Location now, outside its schedule: the kinds named (`audit` crawls its website), or its rankings (a kind already running is skipped)",
          },
        },
      )
      .get(
        "/locations/:locationId/checks",
        async ({ caller, params }) => {
          await gate(caller, "view");
          return checkStatus(ctx, caller.orgId, params.locationId);
        },
        { params: loc, detail: { summary: "Each kind of check: when it last finished, and whether one is running" } },
      )
      .get(
        "/locations/:locationId/runs/:runId",
        async ({ caller, params }) => {
          await gate(caller, "view");
          return progressOf(ctx, caller.orgId, params.locationId, params.runId);
        },
        { params: ids("locationId", "runId"), detail: { summary: "How far a check cycle has got" } },
      )
      .get(
        "/limits",
        async ({ caller }) => {
          await gate(caller, "view");
          return planLimits(ctx, caller.orgId);
        },
        { params: ids(), detail: { summary: "What the Plan allows in SEO (null is unlimited)" } },
      )
      // ---------- Onboarding ----------
      .post(
        "/find",
        async ({ caller, body }) => {
          await gate(caller, "manage");
          return findBusiness(ctx, caller.orgId, body.query, body.near ?? null);
        },
        {
          params: ids(),
          body: t.Object({ query: t.String({ maxLength: 200 }), near: t.Optional(t.Nullable(coordinates)) }),
          detail: { summary: "Find a business on Google" },
        },
      )
      .get(
        "/categories",
        async ({ caller, query }) => {
          await gate(caller, "manage");
          return searchCategories(ctx, caller.orgId, query.q ?? "");
        },
        {
          query: t.Object({ q: t.Optional(t.String({ maxLength: 100 })) }),
          detail: { summary: "Google's business categories matching what's typed" },
        },
      )
      .get(
        "/locations/:locationId/cities",
        async ({ caller, params, query }) => {
          await gate(caller, "manage");
          return searchCityList(ctx, caller.orgId, params.locationId, query.q ?? "");
        },
        {
          params: loc,
          query: t.Object({ q: t.Optional(t.String({ maxLength: 100 })) }),
          detail: { summary: "Google's cities and towns matching what's typed, the business's own state first" },
        },
      )
      .get(
        "/locations/:locationId/details",
        async ({ caller, params }) => {
          await gate(caller, "manage");
          return detailsFor(ctx, caller.orgId, params.locationId);
        },
        { params: loc, detail: { summary: "The business's full Google profile: categories and cities to pick from" } },
      )
      .get(
        "/locations/:locationId/ideas",
        async ({ caller, params, query }) => {
          await gate(caller, "manage");
          const list = (v?: string) => (v ? v.split("|").slice(0, 10) : []);
          return ideasFor(ctx, caller.orgId, params.locationId, { categories: list(query.categories), cities: list(query.cities) });
        },
        {
          params: loc,
          // Lists are joined with "|": a name can hold a comma, never a bar.
          query: t.Object({ categories: t.Optional(t.String({ maxLength: 1000 })), cities: t.Optional(t.String({ maxLength: 1000 })) }),
          detail: { summary: "What to track, suggested from the business and the categories and cities picked" },
        },
      )
      // ---------- Tracking ----------
      .get(
        "/locations/:locationId/keywords",
        async ({ caller, params }) => {
          await gate(caller, "view");
          return listKeywords(ctx, caller.orgId, params.locationId);
        },
        { params: loc, detail: { summary: "The keywords a Location tracks" } },
      )
      .post(
        "/locations/:locationId/keywords",
        async ({ caller, params, body }) => {
          await gate(caller, "track");
          const where = { maps: body.maps ?? true, organic: body.organic ?? true };
          if (!where.maps && !where.organic) throw invalid("Say where to search the keywords: Google Maps, Google search or both.");
          const added = await addKeywords(
            ctx,
            caller.orgId,
            caller.userId,
            params.locationId,
            body.terms,
            body.source ?? "manual",
            null,
            where,
          );
          await queueScopedCheck(ctx, caller.orgId, params.locationId, { keywordIds: added });
          return { added };
        },
        {
          params: loc,
          body: t.Object({
            terms: t.Array(t.String({ maxLength: 120 }), { minItems: 1, maxItems: 100 }),
            source: t.Optional(source),
            /** Searched on Google Maps from the grid, and on Google search; both when left out. */
            maps: t.Optional(t.Boolean()),
            organic: t.Optional(t.Boolean()),
          }),
          detail: { summary: "Track keywords (checked straight away when the Location is active)" },
        },
      )
      .delete(
        "/locations/:locationId/keywords/:keywordId",
        async ({ caller, params, query }) => {
          await gate(caller, "track");
          await removeKeyword(ctx, caller.orgId, caller.userId, params.locationId, params.keywordId, query.from);
          return { ok: true };
        },
        {
          params: ids("locationId", "keywordId"),
          // From one place only, or everywhere when left out.
          query: t.Object({ from: t.Optional(t.Union([t.Literal("maps"), t.Literal("organic")])) }),
          detail: { summary: "Stop tracking a keyword on Google Maps, Google search, or both (its history is kept)" },
        },
      )
      .get(
        "/locations/:locationId/questions",
        async ({ caller, params }) => {
          await gate(caller, "view");
          return listQuestions(ctx, caller.orgId, params.locationId);
        },
        { params: loc, detail: { summary: "The questions a Location asks the AI assistants" } },
      )
      .post(
        "/locations/:locationId/questions",
        async ({ caller, params, body }) => {
          await gate(caller, "track");
          const added = await addQuestions(ctx, caller.orgId, caller.userId, params.locationId, body.texts, body.source ?? "manual");
          await queueScopedCheck(ctx, caller.orgId, params.locationId, { questionIds: added });
          return { added };
        },
        {
          params: loc,
          body: t.Object({ texts: t.Array(t.String({ maxLength: 300 }), { minItems: 1, maxItems: 50 }), source: t.Optional(source) }),
          detail: { summary: "Ask the AI assistants questions (asked straight away when the Location is active)" },
        },
      )
      .delete(
        "/locations/:locationId/questions/:questionId",
        async ({ caller, params }) => {
          await gate(caller, "track");
          await removeQuestion(ctx, caller.orgId, caller.userId, params.locationId, params.questionId);
          return { ok: true };
        },
        { params: ids("locationId", "questionId"), detail: { summary: "Stop asking a question (its history is kept)" } },
      )
      .post(
        "/locations/:locationId/competitors/find",
        async ({ caller, params, body }) => {
          await gate(caller, "track");
          const l = await getLocation(ctx, caller.orgId, params.locationId);
          return findBusiness(ctx, caller.orgId, body.query, { lat: l.lat, lng: l.lng });
        },
        {
          params: loc,
          body: t.Object({ query: t.String({ maxLength: 200 }) }),
          detail: { summary: "Find a business near the Location, to add as a competitor" },
        },
      )
      .get(
        "/locations/:locationId/competitors/overrides",
        async ({ caller, params }) => {
          await gate(caller, "view");
          return listOverrides(ctx, caller.orgId, params.locationId);
        },
        { params: loc, detail: { summary: "Competitors added by hand, and ones hidden" } },
      )
      .post(
        "/locations/:locationId/competitors/overrides",
        async ({ caller, params, body }) => {
          await gate(caller, "track");
          const input =
            body.action === "added"
              ? { action: "added" as const, place: body.place! }
              : { action: "hidden" as const, placeId: body.placeId! };
          if ((input.action === "added" && !body.place) || (input.action === "hidden" && !body.placeId))
            throw new AppError(422, "invalid", "Name the business to add or hide.");
          return { id: await setOverride(ctx, caller.orgId, caller.userId, params.locationId, input) };
        },
        {
          params: loc,
          body: t.Object({ action: overrideAction, place: t.Optional(place), placeId: t.Optional(t.String({ format: "uuid" })) }),
          detail: { summary: "Add a competitor by hand, or hide one that was found" },
        },
      )
      .delete(
        "/locations/:locationId/competitors/overrides/:overrideId",
        async ({ caller, params }) => {
          await gate(caller, "track");
          await removeOverride(ctx, caller.orgId, params.locationId, params.overrideId);
          return { ok: true };
        },
        { params: ids("locationId", "overrideId"), detail: { summary: "Undo adding or hiding a competitor" } },
      )
      // ---------- Results ----------
      .get(
        "/locations/:locationId/overview",
        async ({ caller, params }) => {
          await gate(caller, "view");
          return overview(ctx, caller.orgId, params.locationId);
        },
        { params: loc, detail: { summary: "Where the Location stands: one number per check, and its Google profile's results" } },
      )
      .get(
        "/locations/:locationId/results/maps",
        async ({ caller, params }) => {
          await gate(caller, "view");
          return mapsSummary(ctx, caller.orgId, params.locationId);
        },
        { params: loc, detail: { summary: "Google Maps ranking: every keyword's grid" } },
      )
      .get(
        "/locations/:locationId/results/maps/:keywordId",
        async ({ caller, params }) => {
          await gate(caller, "view");
          return mapsKeyword(ctx, caller.orgId, params.locationId, params.keywordId);
        },
        {
          params: ids("locationId", "keywordId"),
          detail: { summary: "One keyword's grid now and a month ago, who's ahead, and the last 90 days" },
        },
      )
      .get(
        "/locations/:locationId/places/:placeId",
        async ({ caller, params }) => {
          await gate(caller, "view");
          return placeInsight(ctx, caller.orgId, params.locationId, params.placeId);
        },
        {
          params: ids("locationId", "placeId"),
          detail: { summary: "One business up close: profile, reviews over 90 days, and where it stands on each Maps keyword" },
        },
      )
      .get(
        "/locations/:locationId/results/search",
        async ({ caller, params }) => {
          await gate(caller, "view");
          return keywordsPage(ctx, caller.orgId, params.locationId);
        },
        { params: loc, detail: { summary: "Google search: positions and the first page per keyword" } },
      )
      .get(
        "/locations/:locationId/results/ai",
        async ({ caller, params }) => {
          await gate(caller, "view");
          return aiPage(ctx, caller.orgId, params.locationId);
        },
        { params: loc, detail: { summary: "AI answers: who each assistant names, per question" } },
      )
      .get(
        "/locations/:locationId/results/competitors",
        async ({ caller, params, query }) => {
          await gate(caller, "view");
          return competitorsPage(ctx, caller.orgId, params.locationId, query.channel ?? "maps");
        },
        {
          params: loc,
          query: t.Object({ channel: t.Optional(channel) }),
          detail: { summary: "Competitors in one channel, keyword by keyword" },
        },
      )
      .get(
        "/locations/:locationId/results/audit",
        async ({ caller, params }) => {
          await gate(caller, "view");
          return auditPage(ctx, caller.orgId, params.locationId);
        },
        { params: loc, detail: { summary: "Site audit: the website's health and each kind of issue, against the audit before" } },
      )
      .get(
        "/locations/:locationId/results/audit/:code",
        async ({ caller, params }) => {
          await gate(caller, "view");
          return auditIssue(ctx, caller.orgId, params.locationId, params.code);
        },
        {
          params: t.Object({ ...loc.properties, code: t.String({ pattern: "^[a-z_]{2,40}$" }) }),
          detail: { summary: "One kind of site issue: how to fix it, since when, and every page it's on" },
        },
      )
      // ---------- Suggestions ----------
      .get(
        "/locations/:locationId/suggestions",
        async ({ caller, params }) => {
          await gate(caller, "view");
          return listSuggestions(ctx, caller.orgId, params.locationId);
        },
        { params: loc, detail: { summary: "What to do next, and what was done in the last 30 days" } },
      )
      .post(
        "/suggestions/:suggestionId/apply",
        async ({ caller, params, body }) => {
          await gate(caller, await actionFor(ctx, caller.orgId, params.suggestionId));
          await applySuggestion(ctx, actor(caller), params.suggestionId, body ?? undefined);
          return { ok: true };
        },
        {
          params: ids("suggestionId"),
          body: t.Optional(t.Object({ text: t.Optional(t.String({ maxLength: 1500 })) })),
          detail: { summary: "Apply a suggestion (a post's text can be edited first)" },
        },
      )
      .post(
        "/suggestions/:suggestionId/dismiss",
        async ({ caller, params }) => {
          await gate(caller, "track");
          await dismissSuggestion(ctx, caller.orgId, caller.userId, params.suggestionId);
          return { ok: true };
        },
        { params: ids("suggestionId"), detail: { summary: "Not now: the suggestion leaves the list" } },
      )
      .post(
        "/suggestions/:suggestionId/undo",
        async ({ caller, params }) => {
          await gate(caller, await actionFor(ctx, caller.orgId, params.suggestionId));
          await undoSuggestion(ctx, actor(caller), params.suggestionId);
          return { ok: true };
        },
        { params: ids("suggestionId"), detail: { summary: "Undo an applied suggestion" } },
      )
      // ---------- Google profile ----------
      .get(
        "/profile/locations",
        async ({ caller }) => {
          await gate(caller, "manage");
          return profileLocations(ctx, caller.orgId);
        },
        { params: ids(), detail: { summary: "The Google Business Profile locations the connected account manages" } },
      )
      .put(
        "/locations/:locationId/profile",
        async ({ caller, params, body }) => {
          await gate(caller, "manage");
          if (body.name === null) {
            await linkProfile(ctx, caller.orgId, caller.userId, params.locationId, null);
            return { linked: null };
          }
          const linked = await linkLocationProfile(ctx, caller.orgId, caller.userId, params.locationId, body.name);
          if (!linked) throw new AppError(404, "not_found", "That Google profile isn't one the connected account manages.");
          const l = await getLocation(ctx, caller.orgId, params.locationId);
          await syncProfileMetrics(ctx, l).catch(() => undefined);
          return { linked };
        },
        {
          params: loc,
          body: t.Object({ name: t.Optional(t.Nullable(t.String())) }),
          detail: { summary: "Link a Location to its Google profile (by name, or matched by place), or unlink it (null)" },
        },
      ),
  );

  // The provider's pingback: a task is ready. Signed per check, so only the provider we gave the address to can call.
  const pingback = new Elysia({ name: "seo.pingback" }).get(
    "/api/v1/seo/checks/:checkId/ready",
    async ({ params, query }) => {
      if (!safeEqual(query.sig, pingbackSignature(ctx, params.checkId)))
        throw new AppError(401, "unauthorized", "Signature doesn't match.");
      await ctx.enqueue?.(COLLECT_JOB, { checkId: params.checkId, task: query.task ?? null });
      return { ok: true };
    },
    {
      params: t.Object({ checkId: t.String({ format: "uuid" }) }),
      query: t.Object({ sig: t.String(), task: t.Optional(t.String()) }),
      detail: { summary: "The search-data provider says a task is ready" },
    },
  );

  const admin = new Elysia({ name: "seo.admin" }).group("/api/v1/admin/seo", (g) =>
    g.use(ctx.adminGuard!).get("/costs", () => costs(ctx), {
      detail: { summary: "What SEO's search data costs: this month per Organization, and per Location a month" },
    }),
  );

  return new Elysia({ name: "seo.all" }).use(member).use(pingback).use(admin);
}

import { Elysia, t } from "elysia";
import { ids, invalid, type AppContext, type Caller } from "@openmarko/kernel";
import { assertFeatureOn } from "@openmarko/features";
import { requireAllowed } from "@openmarko/shared";
import { invoke } from "@openmarko/integrations";
import { proposeTask } from "@openmarko/automation";
import { activeLocation } from "./locations";
import { connectProfile, disconnectProfile } from "./profile";
import { listReviews, proposeReviewReply } from "./reviews";
import { addKeyword, addCompetitor, listCompetitors, listKeywords, listSnapshots, keywordExists } from "./rankings";
import { addQuestion, listAnswers, listQuestions } from "./ai";
import { listAudits } from "./audit";
import { listCitations } from "./citations";
import { draftArticle, listArticles, publishArticle } from "./articles";
import { listGridScans } from "./grid";
import { listReviewRequests, sendReviewRequest } from "./requests";
import { listBacklinks } from "./backlinks";
import { proposeSiteFix } from "./siteFix";

type SeoFeature = "seo" | "rankings" | "reviews" | "ai_answers" | "site_health" | "citations" | "content";

/**
 * Every SEO route: the feature must be on (403 otherwise), then the caller's permission must allow the action
 * (ADR 0006). In the SEO module each feature is also its own permission resource.
 */
export function seoRoutes(ctx: AppContext) {
  const gate = async (caller: Caller, feature: SeoFeature, action: string) => {
    await assertFeatureOn(ctx, caller.orgId, feature);
    requireAllowed(caller, feature, action);
  };
  /** Long work (syncs, scans, audits) runs in the worker. The route queues it and returns. */
  const queue = async (name: string, caller: Caller, data: Record<string, unknown>) => {
    if (!ctx.enqueue) throw invalid("Background work isn't available in this process.");
    await ctx.enqueue(name, { organizationId: caller.orgId, ...data });
    return { queued: true };
  };

  return new Elysia({ name: "seo" }).group("/api/v1/organizations/:orgId/seo", (g) =>
    g
      .use(ctx.orgGuard!)
      // Business Profile
      .get(
        "/locations/:locationId/profile",
        async ({ caller, params }) => {
          await gate(caller, "seo", "view");
          const loc = await activeLocation(ctx, caller.orgId, params.locationId);
          return { locationId: loc.id, name: loc.name, gbpId: loc.gbpId, websiteUrl: loc.websiteUrl, connected: !!loc.gbpId };
        },
        { detail: { summary: "Get a location's Business Profile status" }, params: ids("locationId") },
      )
      .post(
        "/locations/:locationId/profile/connect",
        async ({ caller, params, body }) => {
          await gate(caller, "seo", "connect");
          return { connectionId: await connectProfile(ctx, caller, params.locationId, body) };
        },
        {
          detail: { summary: "Connect a Google Business Profile to a location" },
          params: ids("locationId"),
          body: t.Object({
            gbpId: t.String({ minLength: 3 }),
            label: t.String({ minLength: 1 }),
            accessToken: t.Optional(t.String()),
            refreshToken: t.Optional(t.String()),
          }),
        },
      )
      // Disconnecting works even with the feature off, so a profile can always be let go.
      .post(
        "/locations/:locationId/profile/disconnect",
        async ({ caller, params }) => {
          requireAllowed(caller, "seo", "connect");
          await disconnectProfile(ctx, caller, params.locationId);
          return { ok: true };
        },
        { detail: { summary: "Disconnect the location's Google Business Profile" }, params: ids("locationId") },
      )
      .post(
        "/locations/:locationId/profile/sync",
        async ({ caller, params }) => {
          await gate(caller, "seo", "edit");
          return queue("seo.profile-sync", caller, { targetId: params.locationId });
        },
        { detail: { summary: "Sync reviews and insights now (queued)" }, params: ids("locationId") },
      )
      // Profile edits are Tasks: applied by Apply, or on their own under Autopilot (ADR 0005).
      .post(
        "/locations/:locationId/profile/edits",
        async ({ caller, params, body }) => {
          await gate(caller, "seo", "edit");
          const loc = await activeLocation(ctx, caller.orgId, params.locationId);
          return proposeTask(ctx, {
            organizationId: caller.orgId,
            kind: "profile_edit",
            featureId: "seo",
            action: "seo.publish",
            title: `Change ${body.field} on ${loc.name}`,
            impact: "medium",
            targetType: "location",
            targetId: loc.id,
            preview: { label: body.field, after: String(body.value) },
            payload: { locationId: loc.id, field: body.field, value: body.value, previous: null },
            createdByType: "member",
            createdBy: caller.userId,
          });
        },
        {
          detail: { summary: "Propose a Business Profile edit (becomes a task)" },
          params: ids("locationId"),
          body: t.Object({ field: t.String({ minLength: 1 }), value: t.Any() }),
        },
      )

      // Reviews
      .get(
        "/locations/:locationId/reviews",
        async ({ caller, params }) => {
          await gate(caller, "reviews", "view");
          return listReviews(ctx, caller.orgId, params.locationId);
        },
        { detail: { summary: "List reviews for a location" }, params: ids("locationId") },
      )
      .post(
        "/reviews/:reviewId/reply",
        async ({ caller, params }) => {
          await gate(caller, "reviews", "reply");
          return proposeReviewReply(ctx, caller.orgId, params.reviewId, { userId: caller.userId, type: "member" });
        },
        { detail: { summary: "Draft a reply to a review (becomes a task)" }, params: ids("reviewId") },
      )
      .get(
        "/locations/:locationId/review-requests",
        async ({ caller, params }) => {
          await gate(caller, "reviews", "view");
          return listReviewRequests(ctx, caller.orgId, params.locationId);
        },
        { detail: { summary: "List review requests sent" }, params: ids("locationId") },
      )
      .post(
        "/locations/:locationId/review-requests",
        async ({ caller, params, body }) => {
          await gate(caller, "reviews", "request");
          return { id: await sendReviewRequest(ctx, caller.orgId, params.locationId, body, caller.userId) };
        },
        {
          detail: { summary: "Email a customer a request for a review" },
          params: ids("locationId"),
          body: t.Object({ email: t.String({ format: "email" }), name: t.Optional(t.String()) }),
        },
      )

      // Rankings
      .get(
        "/locations/:locationId/keywords",
        async ({ caller, params }) => {
          await gate(caller, "rankings", "view");
          return listKeywords(ctx, caller.orgId, params.locationId);
        },
        { detail: { summary: "List tracked keywords" }, params: ids("locationId") },
      )
      .post(
        "/locations/:locationId/keywords",
        async ({ caller, params, body }) => {
          await gate(caller, "rankings", "edit");
          return { id: await addKeyword(ctx, caller.orgId, params.locationId, body.term) };
        },
        { detail: { summary: "Track a keyword" }, params: ids("locationId"), body: t.Object({ term: t.String({ minLength: 2 }) }) },
      )
      .get(
        "/locations/:locationId/competitors",
        async ({ caller, params }) => {
          await gate(caller, "rankings", "view");
          return listCompetitors(ctx, caller.orgId, params.locationId);
        },
        { detail: { summary: "List competitors" }, params: ids("locationId") },
      )
      .post(
        "/locations/:locationId/competitors",
        async ({ caller, params, body }) => {
          await gate(caller, "rankings", "edit");
          return { id: await addCompetitor(ctx, caller.orgId, params.locationId, body.name, body.domain ?? null) };
        },
        {
          detail: { summary: "Add a competitor" },
          params: ids("locationId"),
          body: t.Object({ name: t.String({ minLength: 1 }), domain: t.Optional(t.Union([t.String(), t.Null()])) }),
        },
      )
      .post(
        "/locations/:locationId/rankings/scan",
        async ({ caller, params }) => {
          await gate(caller, "rankings", "scan");
          return queue("seo.rank-scan", caller, { targetId: params.locationId });
        },
        { detail: { summary: "Check rankings for every keyword now (queued)" }, params: ids("locationId") },
      )
      .get(
        "/keywords/:keywordId/snapshots",
        async ({ caller, params }) => {
          await gate(caller, "rankings", "view");
          await keywordExists(ctx, caller.orgId, params.keywordId);
          return listSnapshots(ctx, caller.orgId, params.keywordId);
        },
        { detail: { summary: "List a keyword's rank history" }, params: ids("keywordId") },
      )
      .get(
        "/keyword-ideas",
        async ({ caller, query }) => {
          await gate(caller, "rankings", "view");
          return (await invoke(ctx, caller.orgId, "keywords.research", { seed: query.seed })).output;
        },
        { detail: { summary: "Get keyword ideas for a seed term" }, params: ids(), query: t.Object({ seed: t.String({ minLength: 2 }) }) },
      )
      // Grid scans: a square of map checks around the Location. Each point is one billed request.
      .get(
        "/locations/:locationId/grid-scans",
        async ({ caller, params }) => {
          await gate(caller, "rankings", "view");
          return listGridScans(ctx, caller.orgId, params.locationId);
        },
        { detail: { summary: "List grid scans and their points" }, params: ids("locationId") },
      )
      .post(
        "/locations/:locationId/grid-scans",
        async ({ caller, params, body }) => {
          await gate(caller, "rankings", "scan");
          return queue("seo.grid-scan", caller, { targetId: params.locationId, keyword: body.keyword, size: body.size ?? 5 });
        },
        {
          detail: { summary: "Run a grid scan for a keyword (queued)" },
          params: ids("locationId"),
          body: t.Object({ keyword: t.String({ minLength: 2 }), size: t.Optional(t.Number({ minimum: 3, maximum: 9 })) }),
        },
      )

      // AI answers
      .get(
        "/locations/:locationId/ai-questions",
        async ({ caller, params }) => {
          await gate(caller, "ai_answers", "view");
          return listQuestions(ctx, caller.orgId, params.locationId);
        },
        { detail: { summary: "List the AI questions for a location" }, params: ids("locationId") },
      )
      .post(
        "/locations/:locationId/ai-questions",
        async ({ caller, params, body }) => {
          await gate(caller, "ai_answers", "edit");
          return { id: await addQuestion(ctx, caller.orgId, params.locationId, body.text) };
        },
        {
          detail: { summary: "Add a question to track in AI answers" },
          params: ids("locationId"),
          body: t.Object({ text: t.String({ minLength: 5 }) }),
        },
      )
      .get(
        "/ai-questions/:questionId/answers",
        async ({ caller, params }) => {
          await gate(caller, "ai_answers", "view");
          return listAnswers(ctx, caller.orgId, params.questionId);
        },
        { detail: { summary: "List the AI answers to a question" }, params: ids("questionId") },
      )
      .post(
        "/locations/:locationId/ai-check",
        async ({ caller, params }) => {
          await gate(caller, "ai_answers", "edit");
          return queue("seo.ai-check", caller, { targetId: params.locationId });
        },
        { detail: { summary: "Ask the AI assistants every question now (queued)" }, params: ids("locationId") },
      )

      // Site health (per domain)
      .get(
        "/websites/:websiteId/audits",
        async ({ caller, params }) => {
          await gate(caller, "site_health", "view");
          return listAudits(ctx, caller.orgId, params.websiteId);
        },
        { detail: { summary: "List a website's audits and their issues" }, params: ids("websiteId") },
      )
      .post(
        "/websites/:websiteId/audit",
        async ({ caller, params }) => {
          await gate(caller, "site_health", "fix");
          return queue("seo.audit", caller, { targetId: params.websiteId });
        },
        { detail: { summary: "Run a site audit now (queued)" }, params: ids("websiteId") },
      )
      // An audit issue becomes a Task (applied and undone from /tasks).
      .post(
        "/issues/:issueId/fix",
        async ({ caller, params }) => {
          await gate(caller, "site_health", "fix");
          return proposeSiteFix(ctx, caller.orgId, params.issueId, caller.userId);
        },
        { detail: { summary: "Turn an audit issue into a fix task" }, params: ids("issueId") },
      )

      // Citations and backlinks
      .get(
        "/locations/:locationId/citations",
        async ({ caller, params }) => {
          await gate(caller, "citations", "view");
          return listCitations(ctx, caller.orgId, params.locationId);
        },
        { detail: { summary: "List citations for a location" }, params: ids("locationId") },
      )
      .post(
        "/locations/:locationId/citations/check",
        async ({ caller, params }) => {
          await gate(caller, "citations", "submit");
          return queue("seo.citation-check", caller, { targetId: params.locationId });
        },
        { detail: { summary: "Check the location's citations on six directories (queued)" }, params: ids("locationId") },
      )
      .get(
        "/websites/:websiteId/backlinks",
        async ({ caller, params }) => {
          await gate(caller, "citations", "view");
          return listBacklinks(ctx, caller.orgId, params.websiteId);
        },
        { detail: { summary: "List a website's referring domains, including lost links" }, params: ids("websiteId") },
      )
      .post(
        "/websites/:websiteId/backlinks/check",
        async ({ caller, params }) => {
          await gate(caller, "citations", "submit");
          return queue("seo.backlinks", caller, { targetId: params.websiteId });
        },
        { detail: { summary: "Check a website's backlinks now (queued)" }, params: ids("websiteId") },
      )

      // Articles
      .get(
        "/websites/:websiteId/articles",
        async ({ caller, params }) => {
          await gate(caller, "content", "view");
          return listArticles(ctx, caller.orgId, params.websiteId);
        },
        { detail: { summary: "List articles for a website" }, params: ids("websiteId") },
      )
      .post(
        "/websites/:websiteId/articles",
        async ({ caller, params, body }) => {
          await gate(caller, "content", "edit");
          return { id: await draftArticle(ctx, caller.orgId, params.websiteId, body.keyword, caller.userId) };
        },
        {
          detail: { summary: "Draft an article for a keyword" },
          params: ids("websiteId"),
          body: t.Object({ keyword: t.String({ minLength: 2 }) }),
        },
      )
      .post(
        "/articles/:articleId/publish",
        async ({ caller, params }) => {
          await gate(caller, "content", "publish");
          await publishArticle(ctx, caller.orgId, params.articleId);
          return { ok: true };
        },
        { detail: { summary: "Publish an article through its website's CMS" }, params: ids("articleId") },
      ),
  );
}

// The composition root: which modules exist, and how a process loads the enabled ones.
// apps/api and apps/worker both call this, so they can't disagree about what a module contributes.
import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";
import { sql } from "drizzle-orm";
import {
  adminGuardFrom,
  appConfig,
  AppError,
  buildCatalog,
  handle,
  resolveModules,
  type AppContext,
  type Catalog,
  type ModuleDefinition,
  type ModuleId,
  type ModuleParts,
  type Config,
} from "@app/kernel";
import { identityModule, identityRoutes, requireAdmin } from "@app/identity";
import { orgGuardPlugin, accessModule, accessRoutes } from "@app/access";
import { organizationsModule, organizationRoutes } from "@app/organizations";
import { featuresModule, featureRoutes } from "@app/features";
import { settingsModule, settingsRoutes } from "@app/settings";
import { messagingModule, messagingRoutes } from "@app/messaging";
import { aiModule, aiRoutes } from "@app/ai";
import { knowledgeModule, knowledgeRoutes } from "@app/knowledge";
import { partnersModule, partnerRoutes } from "@app/partners";
import { billingModule, billingRoutes } from "@app/billing";
import { integrationsModule, integrationRoutes } from "@app/integrations";
import { automationModule, automationRoutes } from "@app/automation";
import { seoModule, seoRoutes } from "@app/seo";
import { cors } from "./cors";

export const registry: Record<ModuleId, ModuleDefinition> = {
  identity: identityModule,
  organizations: organizationsModule,
  access: accessModule,
  features: featuresModule,
  settings: settingsModule,
  billing: billingModule,
  integrations: integrationsModule,
  automation: automationModule,
  messaging: messagingModule,
  ai: aiModule,
  knowledge: knowledgeModule,
  partners: partnersModule,
  seo: seoModule,
};

export type Composed = { parts: (ModuleParts & { id: string })[]; modules: ModuleDefinition[] };

/** The names of every job the enabled modules define. */
export const jobNames = (composed: Composed) => composed.parts.flatMap((p) => p.jobs ?? []).map((j) => j.name);
/** Every job's queue, with how it retries: what startQueue creates. */
export const jobQueues = (composed: Composed) => composed.parts.flatMap((p) => p.jobs ?? []).map(({ name, retry }) => ({ name, retry }));

/** The enabled modules, dependencies first. */
const enabledModules = (cfg: Config) => resolveModules(cfg.enabledModules.map((id) => registry[id]));

/** What the enabled modules offer, from their manifests. Throws if two modules declare the same thing. */
export const moduleCatalog = (cfg: Config): Catalog => buildCatalog(enabledModules(cfg));

/** The guards every module's routes use, from the modules that own sessions and membership. */
export function installGuards(ctx: AppContext): void {
  ctx.orgGuard ??= orgGuardPlugin(ctx) as unknown as AppContext["orgGuard"];
  ctx.adminGuard ??= adminGuardFrom((headers) => requireAdmin(ctx, headers)) as unknown as AppContext["adminGuard"];
}

/**
 * Sets the guards and the catalog, then loads each enabled module, in dependency order, and registers its
 * handlers. A handler for an event no module declares fails the boot: it would never run.
 */
export function compose(ctx: AppContext): Composed {
  installGuards(ctx);
  const modules = enabledModules(ctx.cfg);
  ctx.catalog ??= buildCatalog(modules);
  const declared = new Set(ctx.catalog.events.map((e) => e.id));
  const parts = modules.map((m) => ({ id: m.id, ...m.setup(ctx) }));
  for (const p of parts)
    for (const h of p.handlers ?? []) {
      if (!declared.has(h.event)) throw new Error(`${p.id}: handler ${h.name} listens for "${h.event}", which no module declares.`);
      handle(h.event, h.name, h.fn);
    }
  return { parts, modules };
}

/** The HTTP app: every enabled module's routes, plus health, readiness and the API docs. */
export function buildApi(ctx: AppContext, composed = compose(ctx)) {
  const app = new Elysia({ name: "api" })
    .use(cors(ctx))
    .onError(({ error, set, code }) => {
      // One error shape for every failure: { code, message, details? }. Anything unexpected is a 500 with no detail.
      if (error instanceof AppError) {
        set.status = error.status;
        return { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) };
      }
      if (code === "VALIDATION" || code === "PARSE") {
        set.status = 422;
        return { code: "invalid", message: "The request isn't valid.", details: { issues: String(error.message) } };
      }
      if (code === "NOT_FOUND") {
        set.status = 404;
        return { code: "not_found", message: "Nothing at that address." };
      }
      console.error(error);
      set.status = 500;
      return { code: "internal", message: "Something went wrong." };
    })
    .use(
      openapi({
        path: "/openapi",
        documentation: {
          info: {
            title: `${appConfig.name} API`,
            version: "0.1.0",
            description: [
              "Every route is grouped by module. Routes under /organizations/{orgId} need a signed-in member of that organization;",
              "routes under /admin need a signed-in app admin. Sign-in itself is Better Auth, under /api/auth.",
            ].join(" "),
          },
          tags: apiTags.filter((tg) => tg.name === "System" || composed.modules.some((m) => m.apiGroup.name === tg.name)),
        },
        // Better Auth serves its own routes under /api/auth; they're documented by Better Auth, not here.
        exclude: { paths: ["/api/auth/*"] },
      }),
    )
    // Liveness: the process is up. Readiness: it can reach the database (what a load balancer should route on).
    .get("/health", () => ({ ok: true, modules: composed.modules.map((m) => m.id) }), {
      detail: { tags: ["System"], summary: "Liveness: is the process up" },
    })
    .get(
      "/ready",
      async ({ set }) => {
        try {
          await ctx.db.execute(sql`select 1`);
          return { ready: true };
        } catch {
          set.status = 503;
          return { ready: false };
        }
      },
      { detail: { tags: ["System"], summary: "Readiness: can the API reach the database" } },
    );
  for (const p of composed.parts) if (p.routes) app.use(tagged(p.id, p.routes));
  return app;
}

/** The API docs' groups: the system's, then each module's, from its manifest. */
export const apiTags: { name: string; description: string }[] = [
  { name: "System", description: "Health and readiness checks for load balancers and deploys." },
  ...Object.values(registry).map((m) => m.apiGroup),
];

/** Adds the module's tag to every route it contributes, so the docs group them. */
function tagged(moduleId: string, routes: Elysia<any, any, any, any, any, any, any>) {
  const tag = registry[moduleId as ModuleId].apiGroup.name;
  return new Elysia({ name: `tags.${moduleId}` }).guard({ detail: { tags: [tag] } }).use(routes);
}

/** Makes a context for a process that only runs jobs (the worker): routes are never served, so the guards are no-ops. */
export function workerContext(ctx: AppContext): AppContext {
  const none = new Elysia({ name: "no-http" });
  ctx.orgGuard ??= none as unknown as AppContext["orgGuard"];
  ctx.adminGuard ??= none as unknown as AppContext["adminGuard"];
  return ctx;
}

export type { Config, AppContext };
export { startQueue, type QueueClient, type QueueSpec } from "./queue";

/**
 * The full API's shape, for the typed client (Eden). Never called: it only tells TypeScript which routes exist.
 * It lists every module, so the web app's client sees every route whatever app.config.ts turns on; pages of a
 * module that's off are never bundled, so they never call them.
 */
export function apiShape(ctx: AppContext) {
  return new Elysia({ name: "api" })
    .get("/health", () => ({ ok: true as const, modules: [] as string[] }), { detail: { summary: "Liveness: is the process up" } })
    .use(identityRoutes(ctx))
    .use(billingRoutes(ctx))
    .use(accessRoutes(ctx))
    .use(featureRoutes(ctx))
    .use(organizationRoutes(ctx))
    .use(integrationRoutes(ctx))
    .use(automationRoutes(ctx))
    .use(settingsRoutes(ctx))
    .use(messagingRoutes(ctx))
    .use(aiRoutes(ctx))
    .use(knowledgeRoutes(ctx))
    .use(partnerRoutes(ctx))
    .use(seoRoutes(ctx));
}

/** The type the frontend hands to Eden: `treaty<Api>(url)`. */
export type Api = ReturnType<typeof apiShape>;

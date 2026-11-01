// The composition root: which modules exist, and how a process loads the enabled ones.
// apps/api and apps/worker both call this, so they can't disagree about what a module contributes.
import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";
import {
  AppError,
  ConfigError,
  handle,
  providerMode,
  resolveModules,
  type AppContext,
  type ModuleDefinition,
  type ModuleId,
  type ModuleParts,
  type Config,
} from "@openmarko/kernel";
import { identityModule, identityRoutes } from "@openmarko/identity";
import { orgGuardPlugin, accessModule, accessRoutes } from "@openmarko/access";
import { organizationsModule, organizationRoutes } from "@openmarko/organizations";
import { featuresModule, featureRoutes } from "@openmarko/features";
import { settingsModule } from "@openmarko/settings";
import { billingModule, billingRoutes } from "@openmarko/billing";
import { integrationsModule, integrationRoutes } from "@openmarko/integrations";
import { automationModule, automationRoutes } from "@openmarko/automation";
import { seoModule, seoRoutes } from "@openmarko/seo";
import { providers } from "@openmarko/shared";
import { sql } from "drizzle-orm";

export const registry: Record<ModuleId, ModuleDefinition> = {
  identity: identityModule,
  organizations: organizationsModule,
  access: accessModule,
  features: featuresModule,
  settings: settingsModule,
  billing: billingModule,
  integrations: integrationsModule,
  automation: automationModule,
  seo: seoModule,
};

export type Composed = { parts: (ModuleParts & { id: string })[]; modules: ModuleDefinition[] };

/**
 * Deployment checks that need the provider catalog (so they can't live in the kernel's config loader):
 * every name in PROVIDERS_LIVE must be a known provider, and live providers must have what they need to run.
 */
export function checkProviders(cfg: Config): void {
  const problems: string[] = [];
  const known = new Set<string>([...providers.map((p) => p.id), "stripe"]);
  for (const p of cfg.providersLive) if (!known.has(p)) problems.push(`PROVIDERS_LIVE: unknown provider "${p}"`);
  if (providerMode(cfg, "gbp") === "live" && !cfg.google.clientId) {
    problems.push("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET: required when Google Business Profile runs live (token refresh)");
  }
  if (problems.length) throw new ConfigError(problems);
}

/** The names of every job the enabled modules define. */
export const jobNames = (composed: Composed) => composed.parts.flatMap((p) => p.jobs ?? []).map((j) => j.name);

/** Sets the caller guard, then loads each enabled module, in dependency order, and registers its handlers. */
export function compose(ctx: AppContext): Composed {
  checkProviders(ctx.cfg);
  ctx.orgGuard ??= orgGuardPlugin(ctx) as unknown as Elysia<any, any, any, any, any, any, any>;
  const modules = resolveModules(ctx.cfg.enabledModules.map((id) => registry[id]));
  const parts = modules.map((m) => ({ id: m.id, ...m.setup(ctx) }));
  for (const p of parts) for (const h of p.handlers ?? []) handle(h.event, h.name, h.fn);
  return { parts, modules };
}

/** The HTTP app: every enabled module's routes under /api/v1, plus health. */
export function buildApi(ctx: AppContext, composed = compose(ctx)) {
  const app = new Elysia({ name: "openmarko-api" })
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
            title: "OpenMarko API",
            version: "0.1.0",
            description:
              "Every route is grouped by module. Routes under /organizations/{orgId} need a signed-in member of that organization.",
          },
          tags: apiTags,
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

/** How each module shows up in the API docs: one group per module, named for what a reader is looking for. */
export const apiTags: { name: string; description: string }[] = [
  { name: "System", description: "Health and readiness checks for load balancers and deploys." },
  { name: "Identity", description: "Sign-in, sessions and the organizations you belong to." },
  {
    name: "Organizations",
    description: "Organizations, Locations, Websites, members, Partners and clients, transfer-out, and whitelabel brands.",
  },
  { name: "Access", description: "Custom roles and their permissions." },
  { name: "Features", description: "Feature switches for an organization, and what each one needs." },
  { name: "Billing", description: "Plans, entitlements, checkout and usage. Platform admin routes need the admin token." },
  {
    name: "Integrations",
    description: "Connections to providers (Settings → Integrations), the platform's default model, and signed provider webhooks.",
  },
  { name: "Automation", description: "Activity, runs, schedules and tasks (apply, undo, dismiss)." },
  {
    name: "SEO",
    description: "Local SEO: Business Profile, reviews, rankings, AI answers, site health, citations, backlinks and articles.",
  },
];

const tagFor: Record<string, string> = {
  identity: "Identity",
  organizations: "Organizations",
  access: "Access",
  features: "Features",
  billing: "Billing",
  integrations: "Integrations",
  automation: "Automation",
  seo: "SEO",
  settings: "Organizations",
};

/** Adds the module's tag to every route it contributes, so the docs group them. */
function tagged(moduleId: string, routes: Elysia<any, any, any, any, any, any, any>) {
  const tag = tagFor[moduleId] ?? moduleId;
  return new Elysia({ name: `tags.${moduleId}` }).guard({ detail: { tags: [tag] } }).use(routes);
}

/** Makes a context for a process that only runs jobs (the worker): routes are never served, so the guard is a no-op. */
export function workerContext(ctx: AppContext): AppContext {
  ctx.orgGuard ??= new Elysia({ name: "no-http" }) as unknown as Elysia<any, any, any, any, any, any, any>;
  return ctx;
}

export type { Config, AppContext };
export { startQueue, type QueueClient } from "./queue";

/**
 * The full API's shape, for the typed client (Eden). Never called: it only tells TypeScript which routes exist.
 * It lists every module, so the client sees every route whatever ENABLED_MODULES says at runtime. Keep it in step
 * with the module list above.
 */
export function apiShape(ctx: AppContext) {
  return new Elysia({ name: "openmarko-api" })
    .get("/health", () => ({ ok: true as const, modules: [] as string[] }), { detail: { summary: "Liveness: is the process up" } })
    .use(identityRoutes(ctx))
    .use(billingRoutes(ctx))
    .use(accessRoutes(ctx))
    .use(featureRoutes(ctx))
    .use(organizationRoutes(ctx))
    .use(integrationRoutes(ctx))
    .use(automationRoutes(ctx))
    .use(seoRoutes(ctx));
}

/** The type the frontend hands to Eden: `treaty<Api>(url)`. */
export type Api = ReturnType<typeof apiShape>;

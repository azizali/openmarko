import { Elysia } from "elysia";
import { defineModule, type AppContext } from "@openmarko/kernel";
import { createAuth, createAuthPool, type Auth } from "./auth";

const instances = new WeakMap<AppContext, { auth: Auth; pool: ReturnType<typeof createAuthPool> }>();

/** The Better Auth instance for this process. One per context. */
export function authFor(ctx: AppContext): Auth {
  return ensure(ctx).auth;
}

function ensure(ctx: AppContext) {
  let v = instances.get(ctx);
  if (!v) {
    const pool = createAuthPool(ctx.cfg.databaseUrl);
    v = { pool, auth: createAuth(ctx.cfg, pool) };
    instances.set(ctx, v);
  }
  return v;
}

export async function closeAuth(ctx: AppContext) {
  const v = instances.get(ctx);
  if (v) await v.pool.end();
  instances.delete(ctx);
}

export const identityModule = defineModule({
  id: "identity",
  setup: (ctx) => ({ routes: identityRoutes(ctx) }),
});

/** The routes this module adds. Built from the context; used by setup at runtime and by the typed API shape. */
export function identityRoutes(ctx: AppContext) {
  const { auth } = ensure(ctx);
  // Better Auth owns every /api/auth/* route: sign-up, sign-in, sessions, invitations, organizations.
  const routes = new Elysia({ name: "identity" }).all("/api/auth/*", ({ request }) => auth.handler(request));
  return routes;
}

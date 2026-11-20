import { catalogOf, type AppContext } from "@app/kernel";
import { createAuth, createAuthPool, type Auth } from "./auth";

type Instance = { pool: ReturnType<typeof createAuthPool>; auth: Auth };
const instances = new WeakMap<AppContext, Instance>();

/** The app's Better Auth instance, built on first use from the catalog (its Roles) and the context's hooks. */
export function authOf(ctx: AppContext): Auth {
  let v = instances.get(ctx);
  if (!v) {
    const pool = createAuthPool(ctx.cfg.databaseUrl);
    const { resources, groups } = catalogOf(ctx);
    const auth = createAuth(ctx.cfg, pool, {
      access: { resources, groups },
      // Read at send time, so it works whichever module set it up first.
      mail: (template, to, data) => ctx.email?.({ to, template, data }) ?? Promise.resolve(false),
    });
    v = { pool, auth };
    instances.set(ctx, v);
  }
  return v.auth;
}

export async function closeAuth(ctx: AppContext) {
  const v = instances.get(ctx);
  if (v) await v.pool.end();
  instances.delete(ctx);
}

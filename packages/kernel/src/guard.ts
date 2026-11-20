import { Elysia } from "elysia";
import type { AccessCatalog } from "./catalog";

/** Who is calling, in which Organization, with what permission. Resolved once per request. */
export type Caller = {
  userId: string;
  orgId: string;
  role: string;
  permission: Record<string, string[]>;
  /** What Roles are built from: the resources and groups of the enabled modules. */
  access: AccessCatalog;
};

/** The app admin behind a request to /api/v1/admin/*. */
export type Admin = { userId: string; email: string; name: string };

/**
 * The caller guard for routes under /organizations/:orgId. The resolver is injected by the composition root
 * (it needs sessions, which live in identity), so this type-checks in the kernel with no module imports.
 * Routes receive a typed `caller` from it.
 */
export function orgGuardFrom(resolve: (headers: Headers, orgId: string | null) => Promise<Caller>) {
  return new Elysia({ name: "org-guard" }).derive({ as: "scoped" }, async ({ headers, params }) => {
    const orgId = (params as { orgId?: string }).orgId ?? null;
    return { caller: await resolve(new Headers(headers as Record<string, string>), orgId) };
  });
}

/** The admin guard for routes under /api/v1/admin. Routes receive a typed `admin` from it. */
export function adminGuardFrom(resolve: (headers: Headers) => Promise<Admin>) {
  return new Elysia({ name: "admin-guard" }).derive({ as: "scoped" }, async ({ headers }) => ({
    admin: await resolve(new Headers(headers as Record<string, string>)),
  }));
}

export type OrgGuard = ReturnType<typeof orgGuardFrom>;
export type AdminGuard = ReturnType<typeof adminGuardFrom>;

import { Elysia } from "elysia";

/** Who is calling, in which Organization, with what permission. Resolved once per request. */
export type Caller = {
  userId: string;
  orgId: string;
  role: string;
  permission: Record<string, string[]>;
};

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

export type OrgGuard = ReturnType<typeof orgGuardFrom>;

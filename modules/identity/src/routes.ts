import { Elysia } from "elysia";
import { appConfig, type AppContext } from "@app/kernel";
import { authMethods } from "./auth";
import { adminUserRoutes } from "./admin";
import { getSession } from "./session";
import { authOf } from "./instance";

/** The routes this module adds. Built from the context; used by setup at runtime and by the typed API shape. */
export function identityRoutes(ctx: AppContext) {
  return (
    new Elysia({ name: "identity" })
      // Better Auth owns every /api/auth/* route: sign-up, sign-in, sessions, invitations, organizations, admin.
      .all("/api/auth/*", ({ request }) => authOf(ctx).handler(request), {
        detail: { hide: true },
      })
      // What the sign-in page shows: which methods are on. Open.
      .get("/api/v1/auth/methods", () => ({ app: appConfig.name, ...authMethods(ctx.cfg) }), {
        detail: { summary: "Which sign-in methods are on, and the app's name" },
      })
      // Who I am: the session, whether I'm an app admin, and the Organization I'm working in.
      .get(
        "/api/v1/me",
        async ({ request }) => {
          const s = await getSession(ctx, request.headers);
          return s
            ? {
                signedIn: true as const,
                user: { id: s.userId, email: s.email, name: s.name, emailVerified: s.emailVerified },
                admin: s.role === "admin",
                activeOrganizationId: s.activeOrganizationId,
              }
            : { signedIn: false as const };
        },
        { detail: { summary: "Who you are: your account, whether you're an app admin, and your active Organization" } },
      )
      .use(adminUserRoutes(ctx))
  );
}

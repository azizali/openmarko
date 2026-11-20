// Cross-origin requests. A browser may call the API from a trusted origin (the app, the site, TRUSTED_ORIGINS).
// Credentials (cookies) are allowed, so the origin is always echoed, never `*`.
// The chat widget runs on any website its assistant allows; each widget route checks the origin against its
// assistant, and no cookies cross: it authenticates with a visitor token.
import { Elysia } from "elysia";
import type { AppContext } from "@app/kernel";

const ALLOW_HEADERS = "authorization, content-type";
const ALLOW_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";

const allowHeaders = (origin: string) => ({
  "access-control-allow-origin": origin,
  "access-control-allow-credentials": "true",
  vary: "Origin",
});

export function cors(ctx: AppContext) {
  const trusted = new Set(ctx.cfg.trustedOrigins);
  return new Elysia({ name: "cors" }).onRequest(({ request, set }) => {
    const origin = request.headers.get("origin");
    if (!origin) return;
    const path = new URL(request.url).pathname;
    if (path.startsWith("/api/v1/widget/")) {
      const widget = { "access-control-allow-origin": origin, vary: "Origin" };
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            ...widget,
            "access-control-allow-methods": "GET, POST, OPTIONS",
            "access-control-allow-headers": ALLOW_HEADERS,
            "access-control-max-age": "600",
          },
        });
      }
      Object.assign(set.headers, widget);
      return;
    }
    if (!trusted.has(origin)) return request.method === "OPTIONS" ? new Response(null, { status: 403 }) : undefined;
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...allowHeaders(origin),
          "access-control-allow-methods": ALLOW_METHODS,
          "access-control-allow-headers": ALLOW_HEADERS,
          "access-control-max-age": "600",
        },
      });
    }
    Object.assign(set.headers, allowHeaders(origin));
  });
}

// Better Auth's client: sign-up, sign-in, password reset, Organizations and invitations. Same origin as the API
// (/api/auth is forwarded), so cookies are first-party.
import { createAuthClient } from "better-auth/react";
import { adminClient, magicLinkClient, organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  plugins: [organizationClient(), adminClient(), magicLinkClient()],
});

/** Better Auth's error shape, or a fallback. */
export const authError = (e: { error?: { message?: string } | null } | null | undefined, fallback = "Something went wrong.") =>
  e?.error?.message ?? fallback;

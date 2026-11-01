import type { AppContext } from "@openmarko/kernel";
import { authFor } from "./module";

export type SessionInfo = {
  userId: string;
  email: string;
  name: string;
  /** The Organization the user is working in (Better Auth's active organization). */
  activeOrganizationId: string | null;
};

/** Who is calling, from the request's cookies or bearer token. Null when signed out. */
export async function getSession(ctx: AppContext, headers: Headers): Promise<SessionInfo | null> {
  const s = await authFor(ctx).api.getSession({ headers });
  if (!s) return null;
  return {
    userId: s.user.id,
    email: s.user.email,
    name: s.user.name,
    activeOrganizationId: (s.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null,
  };
}

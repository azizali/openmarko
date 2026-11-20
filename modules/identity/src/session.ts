import type { AppContext } from "@app/kernel";
import { authOf } from "./instance";

export type SessionInfo = {
  userId: string;
  email: string;
  name: string;
  emailVerified: boolean;
  /** The admin plugin's role: 'admin' for app admins, else 'user'. */
  role: string;
  /** The Organization the user is working in (Better Auth's active organization). */
  activeOrganizationId: string | null;
};

/** Who is calling, from the session cookie a browser holds (Better Auth's own check). Null when signed out. */
export async function getSession(ctx: AppContext, headers: Headers): Promise<SessionInfo | null> {
  const s = await authOf(ctx).api.getSession({ headers });
  if (!s) return null;
  const user = s.user as { id: string; email: string; name: string; emailVerified: boolean; role?: string | null; banned?: boolean | null };
  if (user.banned) return null;
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    role: user.role ?? "user",
    activeOrganizationId: (s.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null,
  };
}

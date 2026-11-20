// The link an invitation email carries. Signed out: sign in (or up) first, then come back here. Signed in: accept.
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { AuthShell } from "../../components/AuthShell";
import { Feedback, useFeedback } from "../../components/Feedback";
import { Button, Callout } from "../../components/ui";
import { authClient, authError } from "../../lib/auth";
import { useSession } from "../../lib/session";

export default function AcceptInvitation() {
  const { id = "" } = useParams();
  const { me, loading, refresh, switchOrg } = useSession();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<{ organizationName: string; role: string; email: string } | null>(null);
  const fb = useFeedback();
  const { fail } = fb;
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!me) return;
    void authClient.organization.getInvitation({ query: { id } }).then((r) => {
      if (r.error) fail(authError(r), "This invitation isn't valid any more");
      else setInvitation(r.data as typeof invitation);
    });
  }, [id, me, fail]);

  if (loading) return null;
  if (!me) return <Navigate to="/sign-in" replace state={{ from: `/accept-invitation/${id}` }} />;

  const accept = async () => {
    setBusy(true);
    fb.clear();
    const r = await authClient.organization.acceptInvitation({ invitationId: id });
    setBusy(false);
    if (r.error) return fb.fail(authError(r), "Could not join");
    await refresh();
    const orgId = (r.data as { invitation?: { organizationId: string } } | null)?.invitation?.organizationId;
    if (orgId) await switchOrg(orgId);
    navigate("/", { replace: true });
  };

  return (
    <AuthShell title="You're invited" sub={invitation ? `Join ${invitation.organizationName} as ${invitation.role}.` : undefined}>
      <div className="space-y-4">
        {invitation && invitation.email.toLowerCase() !== me.email.toLowerCase() && (
          <Callout>
            This invitation is for {invitation.email}; you're signed in as {me.email}.
          </Callout>
        )}
        <Feedback {...fb.props} />
        <Button variant="primary" className="w-full" disabled={busy || !invitation} onClick={() => void accept()}>
          {busy ? "Joining…" : "Accept the invitation"}
        </Button>
        <p className="text-center text-[12.5px] text-muted">
          <Link to="/" className="hover:text-fg">
            Not now
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

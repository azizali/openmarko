import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AuthShell } from "../../components/AuthShell";
import { Feedback, useFeedback } from "../../components/Feedback";
import { Button, Field, Input } from "../../components/ui";
import { authClient, authError } from "../../lib/auth";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const fb = useFeedback();
  // A link that already failed arrives with ?error=; say so beside the button.
  const linkBad = params.get("error") !== null;
  const { fail } = fb;
  useEffect(() => {
    if (linkBad) fail("Ask for a new one.", "This link isn't valid any more");
  }, [linkBad, fail]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return fb.fail("This link is missing its token. Ask for a new one.", "Could not save");
    setBusy(true);
    fb.clear();
    const r = await authClient.resetPassword({ newPassword: password, token });
    setBusy(false);
    if (r.error) return fb.fail(authError(r), "Could not save");
    navigate("/sign-in", { replace: true });
  };

  return (
    <AuthShell
      title="Choose a new password"
      below={
        <Link to="/forgot-password" className="text-fg underline-offset-2 hover:underline">
          Need a new link?
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password" hint="At least 8 characters.">
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Feedback {...fb.props} />
        <Button type="submit" variant="primary" className="w-full" disabled={busy || !token}>
          {busy ? "Saving…" : "Save and sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}

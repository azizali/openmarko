import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { AuthShell } from "../../components/AuthShell";
import { Feedback, useFeedback } from "../../components/Feedback";
import { Button, Field, Input } from "../../components/ui";
import { authClient, authError } from "../../lib/auth";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const fb = useFeedback();
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    fb.clear();
    const r = await authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (r.error) return fb.fail(authError(r), "Could not send the link");
    fb.succeed("Check your email", "If that email has an account, a link is on its way.");
    setSent(true);
  };

  return (
    <AuthShell
      title="Reset your password"
      sub="We'll email you a link to choose a new one."
      below={
        <Link to="/sign-in" className="text-fg underline-offset-2 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Feedback {...fb.props} />
        <Button type="submit" variant="primary" className="w-full" disabled={busy || sent}>
          {busy ? "Sending…" : "Send the link"}
        </Button>
      </form>
    </AuthShell>
  );
}

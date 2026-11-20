import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { AuthShell } from "../../components/AuthShell";
import { Feedback, useFeedback } from "../../components/Feedback";
import { Button, Field, Input } from "../../components/ui";
import { authClient, authError } from "../../lib/auth";
import { api } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { useSession } from "../../lib/session";

export default function SignUp() {
  const { me, loading, refresh } = useSession();
  const methods = useLoad(() => api.api.v1.auth.methods.get());
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const fb = useFeedback();

  if (!loading && me) return <Navigate to="/" replace />;
  if (methods.data && !methods.data.openSignUp)
    return (
      <AuthShell title="Sign-up is by invitation" sub="Ask the person who runs this app to invite you.">
        <Link to="/sign-in" className="text-[13.5px] underline-offset-2 hover:underline">
          Back to sign in
        </Link>
      </AuthShell>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    fb.clear();
    const r = await authClient.signUp.email({ name, email, password });
    setBusy(false);
    if (r.error) return fb.fail(authError(r), "Sign-up failed");
    await refresh();
    navigate("/onboarding", { replace: true });
  };

  return (
    <AuthShell
      title="Create your account"
      sub={methods.data?.verifyEmail ? "We'll send a link to confirm your email." : undefined}
      below={
        <>
          Already have one?{" "}
          <Link to="/sign-in" className="text-fg underline-offset-2 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Your name">
          <Input autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" hint="At least 8 characters.">
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
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </Button>
        {methods.data?.google && (
          <Button
            type="button"
            className="w-full"
            onClick={() => void authClient.signIn.social({ provider: "google", callbackURL: "/onboarding" })}
          >
            Continue with Google
          </Button>
        )}
      </form>
    </AuthShell>
  );
}

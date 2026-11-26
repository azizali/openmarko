import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { AuthShell, SiteNote } from "../../components/AuthShell";
import { Feedback, useFeedback } from "../../components/Feedback";
import { Button, Field, Input } from "../../components/ui";
import { authClient, authError } from "../../lib/auth";
import { api } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { useSession } from "../../lib/session";
import { forgetSite, rememberSite } from "../../lib/startSite";

export default function SignUp() {
  const { me, loading, refresh } = useSession();
  const methods = useLoad(() => api.api.v1.auth.methods.get());
  const navigate = useNavigate();
  const loc = useLocation();
  // The website typed on the marketing site (?site=), kept for SEO setup to start from.
  const [site, setSite] = useState(() => rememberSite(loc.search));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const fb = useFeedback();

  if (!loading && me) return <Navigate to={site && __MODULE_SEO__ ? "/seo/setup" : "/"} replace />;
  if (methods.data && !methods.data.openSignUp)
    return (
      <AuthShell aside title="Sign-up is by invitation" sub="Ask the person who runs this app to invite you.">
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
      aside
      title={site ? "Get more customers for your business" : "Create your account"}
      sub={
        methods.data?.verifyEmail
          ? "Free to start. We'll send a link to confirm your email."
          : "Free to start, set up in under 10 minutes. No card needed."
      }
      below={
        <>
          Already have one?{" "}
          <Link to="/sign-in" className="text-fg underline-offset-2 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {site && (
        <SiteNote
          site={site}
          onDrop={() => {
            forgetSite();
            setSite(null);
          }}
        >
          Right after this, we look up
        </SiteNote>
      )}
      <form onSubmit={submit} className="space-y-4">
        {methods.data?.google && (
          <>
            <Button
              type="button"
              className="h-11 w-full"
              onClick={() => void authClient.signIn.social({ provider: "google", callbackURL: "/onboarding" })}
            >
              <img src="/icons/google-icon.svg" alt="" width={16} height={16} className="size-4" />
              Continue with Google
            </Button>
            <div className="relative py-3 text-center text-[12px] text-subtle">
              <span className={`relative z-10 px-2 ${__MODULE_SEO__ ? "bg-bg" : "bg-surface"}`}>or with your email</span>
              <span className="absolute inset-x-0 top-1/2 border-t border-line" />
            </div>
          </>
        )}
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
        <Button type="submit" variant="primary" className="h-11 w-full" disabled={busy}>
          {busy ? "Creating…" : "Create my account"}
        </Button>
      </form>
    </AuthShell>
  );
}

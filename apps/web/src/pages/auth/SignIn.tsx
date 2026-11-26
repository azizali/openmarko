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

export default function SignIn() {
  const { me, loading, refresh } = useSession();
  const methods = useLoad(() => api.api.v1.auth.methods.get());
  const navigate = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const fb = useFeedback();
  // Someone with an account who typed their website on the marketing site goes straight to setting it up.
  const [site, setSite] = useState(() => rememberSite(loc.search));
  const from = site && __MODULE_SEO__ ? "/seo/setup" : ((loc.state as { from?: string } | null)?.from ?? "/");

  if (!loading && me) return <Navigate to={from} replace />;

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    fb.clear();
    const r = await authClient.signIn.email({ email, password });
    setBusy(false);
    if (r.error) return fb.fail(authError(r), "Sign-in failed");
    await refresh();
    navigate(from, { replace: true });
  };
  const magic = async () => {
    if (!email) return fb.fail("Enter your email first.", "Could not send the link");
    setBusy(true);
    fb.clear();
    const r = await authClient.signIn.magicLink({ email, callbackURL: from });
    setBusy(false);
    if (r.error) return fb.fail(authError(r), "Could not send the link");
    fb.succeed("Link sent", "Check your email for a sign-in link.");
  };
  const google = () => void authClient.signIn.social({ provider: "google", callbackURL: from });

  return (
    <AuthShell
      aside
      title="Welcome back"
      sub={methods.data ? `Sign in to ${methods.data.app}.` : undefined}
      below={
        methods.data?.openSignUp ? (
          <>
            New here?{" "}
            <Link
              to={site ? `/sign-up?site=${encodeURIComponent(site)}` : "/sign-up"}
              className="text-fg underline-offset-2 hover:underline"
            >
              Create an account
            </Link>
          </>
        ) : null
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
          After you sign in, we set up
        </SiteNote>
      )}
      <form onSubmit={signIn} className="space-y-4">
        {methods.data?.google && (
          <>
            <Button type="button" className="h-11 w-full" onClick={google}>
              <img src="/icons/google-icon.svg" alt="" width={16} height={16} className="size-4" />
              Continue with Google
            </Button>
            <div className="relative py-3 text-center text-[12px] text-subtle">
              <span className={`relative z-10 px-2 ${__MODULE_SEO__ ? "bg-bg" : "bg-surface"}`}>or with your email</span>
              <span className="absolute inset-x-0 top-1/2 border-t border-line" />
            </div>
          </>
        )}
        <Field label="Email">
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Feedback {...fb.props} />
        <Button type="submit" variant="primary" className="h-11 w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <div className="flex justify-between text-[12.5px] text-muted">
          <Link to="/forgot-password" className="hover:text-fg">
            Forgot your password?
          </Link>
          {methods.data?.magicLink && (
            <button type="button" onClick={() => void magic()} className="hover:text-fg">
              Email me a link
            </button>
          )}
        </div>
      </form>
    </AuthShell>
  );
}

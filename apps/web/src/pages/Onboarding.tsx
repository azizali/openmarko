// A new Organization: the first thing after signing up, and how a member adds another.
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { AuthShell } from "../components/AuthShell";
import { Feedback, useFeedback } from "../components/Feedback";
import { Button, Field, Input } from "../components/ui";
import { authClient, authError } from "../lib/auth";
import { useSession } from "../lib/session";
import { slugify } from "../lib/slug";

export default function Onboarding() {
  const { me, loading, organizations, refresh, switchOrg } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const fb = useFeedback();

  if (loading) return null;
  if (!me) return <Navigate to="/sign-in" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    fb.clear();
    const r = await authClient.organization.create({
      name: name.trim(),
      slug: slug || slugify(name),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    } as never);
    setBusy(false);
    if (r.error) return fb.fail(authError(r, "Try again."), "Could not create the organization");
    await refresh();
    await switchOrg((r.data as { id: string }).id);
    navigate("/", { replace: true });
  };

  return (
    <AuthShell
      title={organizations.length ? "New organization" : `Welcome, ${me.name.split(" ")[0]}`}
      sub={
        organizations.length
          ? "A separate space with its own people, settings and data."
          : "Set up your organization: the space your team works in."
      }
      below={
        organizations.length ? (
          <Link to="/" className="text-fg underline-offset-2 hover:underline">
            Back to the app
          </Link>
        ) : null
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Organization name">
          <Input
            required
            maxLength={120}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            placeholder="Acme Inc."
          />
        </Field>
        <Field label="Short name" hint="Lowercase letters, digits and dashes. Used in links.">
          <Input
            required
            pattern="[a-z0-9-]{2,40}"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
          />
        </Field>
        <Feedback {...fb.props} />
        <Button type="submit" variant="primary" className="w-full" disabled={busy || !name.trim()}>
          {busy ? "Creating…" : "Create organization"}
        </Button>
      </form>
    </AuthShell>
  );
}

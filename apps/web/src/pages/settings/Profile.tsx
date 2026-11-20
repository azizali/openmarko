// Profile: the signed-in person's own details, the same in every Organization.
import { useState, type FormEvent } from "react";
import { Avatar, Button, Card, Field, Input } from "../../components/ui";
import { Feedback, useFeedback } from "../../components/Feedback";
import { authClient, authError } from "../../lib/auth";
import { useSession } from "../../lib/session";

export default function Profile() {
  const { me, refresh } = useSession();
  const [name, setName] = useState(me?.name ?? "");
  const [busy, setBusy] = useState(false);
  const fb = useFeedback();
  if (!me) return null;
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    fb.clear();
    const r = await authClient.updateUser({ name: name.trim() });
    setBusy(false);
    if (r.error) return fb.fail(authError(r));
    fb.succeed();
    await refresh();
  };
  return (
    <Card className="max-w-3xl">
      <form onSubmit={save}>
        <Avatar name={name || me.email} className="mb-5 size-12 text-[15px]" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input size="lg" required value={name} onChange={(e) => (fb.clear(), setName(e.target.value))} />
          </Field>
          <Field label="Email" hint="What you sign in with.">
            <Input size="lg" value={me.email} disabled />
          </Field>
        </div>
        <div className="mt-5 flex items-center justify-end gap-4 border-t border-line pt-4">
          <Feedback {...fb.props} />
          <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
            Save
          </Button>
        </div>
      </form>
    </Card>
  );
}

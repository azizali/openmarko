// Admin → Email: whether the app can send, through what, and a test send. The sender itself is edited in Settings.
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Badge, Button, Card, CardHeader, Field, Input } from "../../components/ui";
import { Row } from "../../components/Table";
import { Feedback, useFeedback } from "../../components/Feedback";
import { api, messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { useSession } from "../../lib/session";

export default function Email() {
  const { me } = useSession();
  const status = useLoad(() => api.api.v1.admin.email.get());
  const [to, setTo] = useState(me?.email ?? "");
  const fb = useFeedback();
  const [busy, setBusy] = useState(false);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    fb.clear();
    const r = await api.api.v1.admin.email.test.post({ to });
    setBusy(false);
    if (r.error) return fb.fail(messageOf(r.error), "Could not send");
    fb.succeed("Sent", `The provider answered with message id ${r.data.messageId}.`);
  };
  const s = status.data;
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Can the app send email?"
          right={s && <Badge tone={s.ready ? "good" : "warn"}>{s.ready ? "ready" : "not yet"}</Badge>}
        />
        {s && (
          <>
            <Row label="Sender">
              {s.sender ? (
                `${s.sender.fromName || "(app name)"} <${s.sender.fromEmail}>`
              ) : (
                <Link to="/settings/admin-settings" className="underline-offset-2 hover:underline">
                  Set in Settings → messaging
                </Link>
              )}
            </Row>
            <Row label="Provider">
              {s.connection ? (
                `${s.connection.providerId} (${s.connection.mode})`
              ) : (
                <Link to="/settings/admin-connections" className="underline-offset-2 hover:underline">
                  Connect an email provider
                </Link>
              )}
            </Row>
          </>
        )}
        <p className="mt-3 text-[12.5px] text-subtle">
          Until both are set, sign-up works but no verification, reset or invitation emails go out. In development, connect SMTP to Mailpit
          (localhost:1025) and read mail at localhost:8025.
        </p>
      </Card>
      <Card>
        <CardHeader title="Send a test" />
        <form onSubmit={send} className="flex max-w-md flex-wrap items-end gap-2">
          <Field label="To" className="flex-1">
            <Input type="email" required value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary" disabled={busy || !s?.ready}>
            {busy ? "Sending…" : "Send"}
          </Button>
          <Feedback {...fb.props} className="basis-full" />
        </form>
      </Card>
    </div>
  );
}

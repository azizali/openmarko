// Admin → Assistants: every assistant across Organizations, and a test chat with any of them.
import { useState, type FormEvent } from "react";
import { Badge, Button, Card, CardHeader, Field, Input } from "../../components/ui";
import { Table } from "../../components/Table";
import { Feedback, useFeedback } from "../../components/Feedback";
import { api, fmtTime, messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";

export default function Assistants() {
  const list = useLoad(() => api.api.v1.admin.ai.assistants.get());
  const [testing, setTesting] = useState<string | null>(null);
  const [message, setMessage] = useState("Hello! What can you help with?");
  const [answer, setAnswer] = useState<{ text: string; model: string; sources: { n: number; documentTitle: string }[] } | null>(null);
  const fb = useFeedback();
  const [busy, setBusy] = useState(false);
  const run = async (e: FormEvent) => {
    e.preventDefault();
    if (!testing) return;
    setBusy(true);
    fb.clear();
    const r = await api.api.v1.admin.ai.assistants({ assistantId: testing }).test.post({ message });
    setBusy(false);
    if (r.error) return fb.fail(messageOf(r.error), "Could not ask");
    setAnswer(r.data);
  };
  return (
    <div className="space-y-5">
      <Table
        head={["Assistant", "Organization", "Model", "Knowledge", "Widget", "Updated", ""]}
        empty="No assistants yet. Organizations make theirs under Widgets."
        rows={(list.data ?? []).map((a) => [
          <span key="n" className="font-medium">
            {a.name}
          </span>,
          a.organization,
          <code key="m" className="font-mono text-[12.5px]">
            {a.model ?? "default"}
          </code>,
          `${a.knowledgeBaseIds.length} base${a.knowledgeBaseIds.length === 1 ? "" : "s"}`,
          a.widget.enabled ? (
            <Badge key="w" tone="good">
              on
            </Badge>
          ) : (
            <span key="w" className="text-subtle">
              off
            </span>
          ),
          <span key="u" className="text-muted">
            {fmtTime(a.updatedAt as unknown as string)}
          </span>,
          <Button key="t" size="sm" onClick={() => (setTesting(a.id), setAnswer(null))}>
            Try
          </Button>,
        ])}
      />
      {testing && (
        <Card>
          <CardHeader
            title={`Try ${list.data?.find((a) => a.id === testing)?.name ?? "the assistant"}`}
            sub="One message; the answer and the knowledge it was given. Not saved, not metered."
            right={
              <Button size="sm" variant="ghost" onClick={() => setTesting(null)}>
                Close
              </Button>
            }
          />
          <form onSubmit={run} className="flex max-w-xl flex-wrap items-end gap-2">
            <Field label="Message" className="flex-1">
              <Input value={message} onChange={(e) => setMessage(e.target.value)} />
            </Field>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Asking…" : "Ask"}
            </Button>
            <Feedback {...fb.props} className="basis-full" />
          </form>
          {answer && (
            <div className="mt-3 space-y-2">
              <p className="rounded-lg bg-hover p-3 text-[13.5px] whitespace-pre-wrap">{answer.text}</p>
              <p className="text-[12px] text-muted">
                {answer.model}
                {answer.sources.length ? ` · sources: ${answer.sources.map((s) => `[${s.n}] ${s.documentTitle}`).join(", ")}` : ""}
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

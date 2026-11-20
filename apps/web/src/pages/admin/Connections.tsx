// The app's own accounts with providers: the model key and the email provider every Organization without its own
// uses, and any other provider whose webhooks the app receives.
import { useState } from "react";
import { Badge, Button, Callout, Card, CardHeader, Field, Select } from "../../components/ui";
import { Table } from "../../components/Table";
import { useToast } from "../../components/Feedback";
import { ConnectForm, ProviderMark } from "../Settings";
import { api, fmtDate, messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";

export default function Connections() {
  const providers = useLoad(() => api.api.v1.admin.connections.providers.get());
  const connections = useLoad(() => api.api.v1.admin.connections.get());
  const [connecting, setConnecting] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | "stub">("live");
  const toast = useToast();
  const list = providers.data ?? [];
  const byProvider = new Map((connections.data ?? []).map((c) => [c.providerId, c]));

  const connect = async (providerId: string, label: string, values: Record<string, string>) => {
    const r = await api.api.v1.admin.connections.post({ providerId, label, values, mode });
    if (r.error) return messageOf(r.error);
    setConnecting(null);
    void connections.reload();
    return null;
  };
  const switchMode = async (id: string, next: "live" | "stub") => {
    const r = await api.api.v1.admin.connections({ connectionId: id }).patch({ mode: next });
    if (r.error) return toast.error(messageOf(r.error), "Could not switch mode");
    void connections.reload();
  };
  const disconnect = async (id: string) => {
    if (!confirm("Disconnect this account? Organizations without their own lose it.")) return;
    const r = await api.api.v1.admin.connections({ connectionId: id }).delete();
    if (r.error) return toast.error(messageOf(r.error), "Could not disconnect");
    void connections.reload();
  };

  return (
    <div className="space-y-5">
      <Callout>
        A stub answers with made-up data and no network call, so the app works without a vendor account. Live calls the vendor with your
        key. Choose when you connect, and switch at any time.
      </Callout>
      {[...new Set(list.map((p) => p.category))].map((cat) => (
        <Card key={cat}>
          <CardHeader title={cat} />
          <ul className="divide-y divide-line">
            {list
              .filter((p) => p.category === cat)
              .map((p) => {
                const c = byProvider.get(p.id);
                return (
                  <li key={p.id} className="py-3">
                    <div className="flex items-center gap-3">
                      <ProviderMark p={p} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-[13.5px] font-medium">
                          {p.name}
                          {c && (
                            <Badge tone={c.mode === "live" ? "good" : "neutral"}>
                              {c.mode === "live" ? "connected" : "connected · stub"}
                            </Badge>
                          )}
                        </span>
                        <span className="block text-[12.5px] text-muted">{c ? c.label : p.blurb}</span>
                      </span>
                      {c ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => void switchMode(c.id, c.mode === "live" ? "stub" : "live")}>
                            {c.mode === "live" ? "Use stub" : "Go live"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => void disconnect(c.id)}>
                            Disconnect
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" onClick={() => setConnecting(connecting === p.id ? null : p.id)}>
                          Connect
                        </Button>
                      )}
                    </div>
                    {connecting === p.id && (
                      <div className="mt-3 max-w-md space-y-3 rounded-lg border border-line p-4">
                        <Field label="Mode">
                          <Select value={mode} onChange={(e) => setMode(e.target.value as "live" | "stub")}>
                            <option value="live">Live: call the vendor with this key</option>
                            <option value="stub">Stub: made-up data, no network</option>
                          </Select>
                        </Field>
                        <ConnectForm
                          provider={p as never}
                          onSubmit={(label, values) => connect(p.id, label, values)}
                          onCancel={() => setConnecting(null)}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        </Card>
      ))}
      {(connections.data ?? []).length > 0 && (
        <Table
          head={["Connection", "Provider", "Mode", "Since"]}
          rows={(connections.data ?? []).map((c) => [
            c.label,
            c.providerId,
            <Badge key="m" tone={c.mode === "live" ? "good" : "neutral"}>
              {c.mode}
            </Badge>,
            fmtDate(c.createdAt as unknown as string),
          ])}
        />
      )}
    </div>
  );
}

// Admin → Models: everything about the app's models in one place. The vendors and their keys (connect, live or stub,
// disconnect), the models each connected vendor offers as its own API lists them, the app's model names and default,
// and a prompt to try one.
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { RefreshCw } from "lucide-react";
import { Badge, Button, Card, CardHeader, Field, Input, Select, Textarea } from "../../components/ui";
import { Table } from "../../components/Table";
import { Feedback, LoadError, useFeedback, useToast } from "../../components/Feedback";
import { ConnectForm, ProviderMark } from "../Settings";
import { api, messageOf } from "../../lib/api";
import { announceChatAssistantChanged } from "../../lib/chatAssistant";
import { useLoad } from "../../lib/useLoad";

type Vendor = "anthropic" | "openai" | "google" | "openrouter";
type Mode = "live" | "stub";
type VendorModel = {
  id: string;
  vendor: Vendor;
  model: string;
  name: string;
  kind: "chat" | "embedding" | "other";
  contextLength: number | null;
  pricing: { input: number; output: number } | null;
};
type Named = { model: string; temperature?: number; maxOutputTokens?: number };
type Draft = { defaultModel: string; models: Record<string, Named> };

const VENDORS: Vendor[] = ["anthropic", "openai", "google", "openrouter"];
/** A vendor's Connection is its provider in the catalog. */
const providerOf: Record<Vendor, string> = { anthropic: "anthropic", openai: "openai", google: "google_ai", openrouter: "openrouter" };
const CUSTOM = "__custom__";

const byVendorOf = (models: VendorModel[]) => {
  const out = new Map<Vendor, VendorModel[]>();
  for (const m of models) out.set(m.vendor, [...(out.get(m.vendor) ?? []), m]);
  return out;
};

const fmtK = (n: number | null) => (n === null ? "" : n >= 1_000_000 ? `${Math.round(n / 100_000) / 10}M` : `${Math.round(n / 1000)}k`);
const fmtPrice = (p: VendorModel["pricing"]) => (p ? `$${p.input} / $${p.output}` : "");

export default function Models() {
  const ai = useLoad(() => api.api.v1.admin.ai.get());
  const connections = useLoad(() => api.api.v1.admin.connections.get());
  const providers = useLoad(() => api.api.v1.admin.connections.providers.get());

  const connected = useMemo(() => {
    const by = new Map((connections.data ?? []).map((c) => [c.providerId, c]));
    return VENDORS.map((vendor) => ({ vendor, connection: by.get(providerOf[vendor]) ?? null }));
  }, [connections.data]);
  const live = connected.filter((v) => v.connection).map((v) => v.vendor);

  // The models every connected vendor offers, by vendor. Asked once per vendor, again on Refresh.
  const [offered, setOffered] = useState<Record<string, VendorModel[] | string>>({});
  const loadOffered = async (vendor: Vendor, fresh = false) => {
    const r = await api.api.v1.admin.ai.vendors({ vendor }).models.get({ query: fresh ? { fresh: "true" } : {} });
    setOffered((o) => ({ ...o, [vendor]: r.error ? messageOf(r.error) : (r.data as VendorModel[]) }));
  };
  useEffect(() => {
    for (const vendor of live) if (!(vendor in offered)) void loadOffered(vendor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.join(",")]);
  const offeredList = (vendor: Vendor) => (Array.isArray(offered[vendor]) ? (offered[vendor] as VendorModel[]) : []);
  const chatModels = live.flatMap((v) => offeredList(v).filter((m) => m.kind === "chat"));

  const reloadKeys = () => {
    void connections.reload();
    void ai.reload();
  };

  if (ai.error) return <LoadError>{ai.error}</LoadError>;
  if (!ai.data) return null;

  return (
    <div className="space-y-5">
      <Vendors
        rows={connected}
        catalog={(providers.data ?? []).filter((p) => p.category === "AI models")}
        onChanged={(vendor) => {
          reloadKeys();
          setOffered((o) => {
            const { [vendor]: _gone, ...rest } = o;
            return rest;
          });
        }}
      />
      <Names saved={ai.data.settings as Draft} chatModels={chatModels} onSaved={() => void ai.reload()} />
      <AppAssistant />
      {live.length > 0 && <Offered vendors={live} offered={offered} onRefresh={(v) => void loadOffered(v, true)} />}
      <Try settings={ai.data.settings as Draft} chatModels={chatModels} />
    </div>
  );
}

// ---------- Vendors and their keys ----------

type Catalog = { id: string; name: string; mark: string; color: string; blurb: string; fields: unknown[] };
type Conn = { id: string; label: string; mode: string };

function Vendors({
  rows,
  catalog,
  onChanged,
}: {
  rows: { vendor: Vendor; connection: Conn | null }[];
  catalog: Catalog[];
  onChanged: (vendor: Vendor) => void;
}) {
  const toast = useToast();
  const [connecting, setConnecting] = useState<Vendor | null>(null);
  const [mode, setMode] = useState<Mode>("live");

  const connect = async (vendor: Vendor, label: string, values: Record<string, string>) => {
    const r = await api.api.v1.admin.connections.post({ providerId: providerOf[vendor], label, values, mode });
    if (r.error) return messageOf(r.error);
    setConnecting(null);
    onChanged(vendor);
    return null;
  };
  const switchMode = async (vendor: Vendor, c: Conn) => {
    const r = await api.api.v1.admin.connections({ connectionId: c.id }).patch({ mode: c.mode === "live" ? "stub" : "live" });
    if (r.error) return toast.error(messageOf(r.error), "Could not switch mode");
    onChanged(vendor);
  };
  const disconnect = async (vendor: Vendor, c: Conn) => {
    if (!confirm(`Disconnect ${c.label}? Models of this vendor stop answering for Organizations without their own key.`)) return;
    const r = await api.api.v1.admin.connections({ connectionId: c.id }).delete();
    if (r.error) return toast.error(messageOf(r.error), "Could not disconnect");
    onChanged(vendor);
  };

  return (
    <Card>
      <CardHeader
        title="Vendors"
        sub="The app's own key with each vendor, used wherever an Organization hasn't connected its own. Live calls the vendor; a stub answers with made-up text and no network."
      />
      <ul className="divide-y divide-line">
        {rows.map(({ vendor, connection: c }) => {
          const p = catalog.find((x) => x.id === providerOf[vendor]);
          if (!p) return null;
          return (
            <li key={vendor} className="py-3">
              <div className="flex items-center gap-3">
                <ProviderMark p={p} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 text-[13.5px] font-medium">
                    {p.name}
                    <code className="font-mono text-[12px] text-muted">{vendor}/…</code>
                    {c && <Badge tone={c.mode === "live" ? "good" : "neutral"}>{c.mode === "live" ? "live" : "stub"}</Badge>}
                  </span>
                  <span className="block text-[12.5px] text-muted">{c ? c.label : p.blurb}</span>
                </span>
                {c ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => void switchMode(vendor, c)}>
                      {c.mode === "live" ? "Use stub" : "Go live"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void disconnect(vendor, c)}>
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => setConnecting(connecting === vendor ? null : vendor)}>
                    Connect
                  </Button>
                )}
              </div>
              {connecting === vendor && (
                <div className="mt-3 max-w-md space-y-3 rounded-lg border border-line p-4 sm:ml-11">
                  <Field label="Mode">
                    <Select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                      <option value="live">Live: call the vendor with this key</option>
                      <option value="stub">Stub: made-up answers, no network</option>
                    </Select>
                  </Field>
                  <ConnectForm
                    provider={p as never}
                    onSubmit={(label, values) => connect(vendor, label, values)}
                    onCancel={() => setConnecting(null)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ---------- The app's model names ----------

type Row = { key: number; name: string; model: string; temperature: string; maxOutputTokens: string };
let nextKey = 1;
const rowsOf = (d: Draft): Row[] =>
  Object.entries(d.models).map(([name, m]) => ({
    key: nextKey++,
    name,
    model: m.model,
    temperature: m.temperature === undefined ? "" : String(m.temperature),
    maxOutputTokens: m.maxOutputTokens === undefined ? "" : String(m.maxOutputTokens),
  }));

function Names({ saved, chatModels, onSaved }: { saved: Draft; chatModels: VendorModel[]; onSaved: () => void }) {
  const [rows, setRows] = useState<Row[]>(() => rowsOf(saved));
  const [defaultModel, setDefaultModel] = useState(saved.defaultModel);
  const [busy, setBusy] = useState(false);
  const fb = useFeedback();
  useEffect(() => {
    setRows(rowsOf(saved));
    setDefaultModel(saved.defaultModel);
  }, [saved]);

  const dirty = useMemo(() => JSON.stringify(toDraft(rows, defaultModel)) !== JSON.stringify(saved), [rows, defaultModel, saved]);
  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = (model = "") => setRows((rs) => [...rs, { key: nextKey++, name: "", model, temperature: "", maxOutputTokens: "" }]);
  const remove = (key: number) => setRows((rs) => rs.filter((r) => r.key !== key));

  const save = async () => {
    setBusy(true);
    fb.clear();
    const r = await api.api.v1.admin.settings({ namespace: "ai" }).put({ value: toDraft(rows, defaultModel) });
    setBusy(false);
    if (r.error) return fb.fail(messageOf(r.error));
    fb.succeed("Saved", "Chats that name no model use the default from their next message.");
    onSaved();
  };

  const names = rows.map((r) => r.name).filter(Boolean);
  return (
    <Card>
      <CardHeader
        title="Model names"
        sub="The app's own names for models, e.g. fast → openai/gpt-5-mini. Assistants and chats pick a name, so the model behind it can change here without touching them."
        right={
          <Button size="sm" onClick={() => add()}>
            Add name
          </Button>
        }
      />
      <Table
        head={["Name", "Model", "Temperature", "Max output tokens", ""]}
        empty="No names yet. Add one and point it at a model from a connected vendor."
        rows={rows.map((r) => [
          <Input
            key="n"
            value={r.name}
            placeholder="fast"
            className="font-mono"
            onChange={(e) => update(r.key, { name: e.target.value })}
          />,
          <ModelPicker key="m" value={r.model} chatModels={chatModels} onChange={(model) => update(r.key, { model })} />,
          <Input
            key="t"
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={r.temperature}
            placeholder="vendor's"
            onChange={(e) => update(r.key, { temperature: e.target.value })}
          />,
          <Input
            key="x"
            type="number"
            min={1}
            max={64000}
            value={r.maxOutputTokens}
            placeholder="vendor's"
            onChange={(e) => update(r.key, { maxOutputTokens: e.target.value })}
          />,
          <Button key="d" size="sm" variant="ghost" onClick={() => remove(r.key)}>
            Remove
          </Button>,
        ])}
      />
      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
        <Field label="Default model" hint="Used when a chat or assistant names no model." className="min-w-56">
          <Select value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)}>
            <option value="">None: every request must name a model</option>
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
        <Feedback {...fb.props} className="order-last basis-full sm:order-none sm:basis-0" />
        <Button variant="primary" disabled={!dirty || busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}

// ---------- The widget the app's chat uses ----------

/**
 * The chat button inside the app answers as one widget (ADR 0031). Here an app admin sees which one is chosen for
 * everyone, and changes it. The same choice is a button on the widget's own page.
 */
function AppAssistant() {
  const current = useLoad(() => api.api.v1.admin.ai["chat-assistant"].get());
  const widgets = useLoad(() => api.api.v1.admin.ai.assistants.get());
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fb = useFeedback();
  const chosen = current.data?.assistantId ?? "";
  const value = picked ?? chosen;

  const save = async () => {
    setBusy(true);
    fb.clear();
    const r = await api.api.v1.admin.ai["chat-assistant"].put({ assistantId: value || null });
    setBusy(false);
    if (r.error) return fb.fail(messageOf(r.error));
    setPicked(null);
    await current.reload();
    announceChatAssistantChanged();
    fb.succeed(value ? "Saved" : "Back to each organization's built-in widget");
  };

  return (
    <Card>
      <CardHeader
        title="Chat widget in the app"
        sub="The widget behind the chat button for every organization that hasn't chosen its own (a Partner's choice reaches its Clients). Build and test it under Widgets, then choose it here or from its page."
      />
      <LoadError what="the app's chat widget">{current.error ?? widgets.error}</LoadError>
      <div className="flex flex-wrap items-end gap-3">
        <Field
          label="Widget"
          hint="Empty: each organization uses its own built-in widget, with no instructions and the default model."
          className="min-w-72"
        >
          <Select value={value} onChange={(e) => setPicked(e.target.value)}>
            <option value="">Each organization's built-in widget</option>
            {(widgets.data ?? []).map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} · {w.organization}
              </option>
            ))}
          </Select>
        </Field>
        <Feedback {...fb.props} className="order-last basis-full sm:order-none sm:basis-0" />
        <Button variant="primary" disabled={busy || value === chosen} onClick={() => void save()}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}

function toDraft(rows: Row[], defaultModel: string): Draft {
  const models: Record<string, Named> = {};
  for (const r of rows) {
    if (!r.name.trim() && !r.model.trim()) continue;
    models[r.name.trim()] = {
      model: r.model.trim(),
      ...(r.temperature !== "" ? { temperature: Number(r.temperature) } : {}),
      ...(r.maxOutputTokens !== "" ? { maxOutputTokens: Number(r.maxOutputTokens) } : {}),
    };
  }
  return { defaultModel: models[defaultModel] ? defaultModel : "", models };
}

/** A model from a connected vendor, or one typed by hand (for a model the vendor's list doesn't show yet). */
function ModelPicker({ value, chatModels, onChange }: { value: string; chatModels: VendorModel[]; onChange: (v: string) => void }) {
  const known = chatModels.some((m) => m.id === value);
  const [custom, setCustom] = useState(!known && value !== "");
  const byVendor = useMemo(() => byVendorOf(chatModels), [chatModels]);
  if (custom || (value && !known)) {
    return (
      <span className="flex items-center gap-1">
        <Input value={value} placeholder="vendor/model" className="font-mono" onChange={(e) => onChange(e.target.value)} />
        {chatModels.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setCustom(false);
              onChange("");
            }}
          >
            List
          </Button>
        )}
      </span>
    );
  }
  return (
    <Select
      value={value}
      className="font-mono"
      onChange={(e) => {
        if (e.target.value === CUSTOM) return setCustom(true);
        onChange(e.target.value);
      }}
    >
      <option value="">Pick a model…</option>
      {[...byVendor].map(([vendor, models]) => (
        <optgroup key={vendor} label={vendor}>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id}
            </option>
          ))}
        </optgroup>
      ))}
      <option value={CUSTOM}>Type a model id…</option>
    </Select>
  );
}

// ---------- What each vendor offers ----------

function Offered({
  vendors,
  offered,
  onRefresh,
}: {
  vendors: Vendor[];
  offered: Record<string, VendorModel[] | string>;
  onRefresh: (v: Vendor) => void;
}) {
  const [vendor, setVendor] = useState<Vendor>(vendors[0]!);
  const [filter, setFilter] = useState("");
  const current = vendors.includes(vendor) ? vendor : vendors[0]!;
  const got = offered[current];
  const list = Array.isArray(got) ? got : [];
  const q = filter.trim().toLowerCase();
  const shown = list.filter((m) => !q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)).slice(0, 200);
  const hasPrices = list.some((m) => m.pricing);
  const hasContext = list.some((m) => m.contextLength);

  return (
    <Card>
      <CardHeader
        title="Models available"
        sub="What each connected vendor offers, as its own API lists them. Kept for ten minutes; Refresh asks again. Prices are USD per million tokens, in / out, where the vendor says."
        right={
          <Button size="sm" variant="ghost" icon={<RefreshCw size={14} />} onClick={() => onRefresh(current)}>
            Refresh
          </Button>
        }
      />
      <div className="mb-3 flex flex-wrap gap-3">
        <Select value={current} onChange={(e) => setVendor(e.target.value as Vendor)} className="w-44">
          {vendors.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
        <Input value={filter} placeholder="Filter…" onChange={(e) => setFilter(e.target.value)} className="w-60" />
      </div>
      {typeof got === "string" && <LoadError what={`${current}'s models`}>{got}</LoadError>}
      {got === undefined && <p className="text-[13px] text-muted">Asking {current}…</p>}
      {Array.isArray(got) && (
        <>
          <Table
            head={["Model", "Name", "Kind", ...(hasContext ? ["Context"] : []), ...(hasPrices ? ["Price"] : [])]}
            empty="Nothing matches."
            rows={shown.map((m) => [
              <code key="i" className="font-mono text-[12.5px]">
                {m.id}
              </code>,
              m.name === m.model ? "" : m.name,
              <Badge key="k" tone={m.kind === "chat" ? "info" : m.kind === "embedding" ? "accent" : "neutral"}>
                {m.kind}
              </Badge>,
              ...(hasContext ? [fmtK(m.contextLength)] : []),
              ...(hasPrices ? [fmtPrice(m.pricing)] : []),
            ])}
          />
          {list.length > shown.length && (
            <p className="mt-2 text-[12px] text-muted">
              {shown.length} of {list.length} shown. Filter to see others.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

// ---------- Try one ----------

function Try({ settings, chatModels }: { settings: Draft; chatModels: VendorModel[] }) {
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("Say hello in one sentence.");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ text: string; name: string; model: string; mode: string; tokens: number; ms: number } | null>(
    null,
  );
  const fb = useFeedback();
  const byVendor = useMemo(() => byVendorOf(chatModels), [chatModels]);

  const run = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    fb.clear();
    const res = await api.api.v1.admin.ai.test.post({ prompt, ...(model ? { model } : {}) });
    setBusy(false);
    if (res.error) return fb.fail(messageOf(res.error), "Could not ask");
    setAnswer({
      text: res.data.text,
      name: res.data.name,
      model: res.data.model,
      mode: res.data.mode,
      tokens: res.data.usage.totalTokens ?? 0,
      ms: res.data.ms,
    });
  };

  return (
    <Card>
      <CardHeader title="Try a model" sub="One prompt, not saved, not metered. A stub echoes the prompt back." />
      <form onSubmit={run} className="max-w-xl space-y-3">
        <Field label="Model">
          <Select value={model} onChange={(e) => setModel(e.target.value)} className="font-mono">
            <option value="">Default{settings.defaultModel ? ` (${settings.defaultModel})` : " (none set)"}</option>
            {Object.keys(settings.models).length > 0 && (
              <optgroup label="the app's names">
                {Object.entries(settings.models).map(([name, m]) => (
                  <option key={name} value={name}>
                    {name} → {m.model}
                  </option>
                ))}
              </optgroup>
            )}
            {[...byVendor].map(([vendor, models]) => (
              <optgroup key={vendor} label={vendor}>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field label="Prompt">
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Asking…" : "Ask"}
          </Button>
          <Feedback {...fb.props} />
        </div>
      </form>
      {answer && (
        <div className="mt-4 space-y-1">
          <p className="text-[12px] text-muted">
            {answer.name !== answer.model ? `${answer.name} → ` : ""}
            {answer.model} · {answer.mode} · {answer.tokens} tokens · {answer.ms} ms
          </p>
          <p className="rounded-lg bg-hover p-3 text-[13.5px] whitespace-pre-wrap">{answer.text}</p>
        </div>
      )}
    </Card>
  );
}

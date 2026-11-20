// Widgets: an Organization's chat widgets, in one view. Each widget is an Assistant: what it knows (instructions,
// model, knowledge bases), how it looks, and the websites it may answer on. The preview is the real widget, the same
// UI a website embeds, chatting through the member's conversations so it works before any website is allowed.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router";
import { Check, ChevronRight, Copy, MessagesSquare, X } from "lucide-react";
import { accentTheme, mountChat, type ChatHandle } from "@app/chat-widget/chat";
import { Badge, Button, Card, Checkbox, Empty, Field, Input, NewButton, PageHeader, Select, Textarea, Toggle } from "../components/ui";
import { Feedback, LoadError, useFeedback, useToast } from "../components/Feedback";
import { api, messageOf } from "../lib/api";
import { announceChatAssistantChanged, levelWho, type ChatLevel } from "../lib/chatAssistant";
import { memberBackend } from "../lib/memberChat";
import { modules } from "../lib/modules";
import { useOrg, useSession } from "../lib/session";
import { useLoad } from "../lib/useLoad";

type Draft = {
  name: string;
  instructions: string;
  model: string | null;
  knowledgeBaseIds: string[];
  widget: { enabled: boolean; allowedOrigins: string[]; greeting: string; accent: string };
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
const draftOf = (a: Draft): Draft => ({
  name: a.name,
  instructions: a.instructions,
  model: a.model,
  knowledgeBaseIds: a.knowledgeBaseIds,
  widget: {
    enabled: a.widget.enabled,
    allowedOrigins: a.widget.allowedOrigins,
    greeting: a.widget.greeting,
    accent: a.widget.accent,
  },
});

/** What someone typed or pasted, as the origin the API checks: example.com and https://example.com/about both work. */
export function toOrigin(raw: string): string | null {
  const text = raw.trim();
  const local = /^(localhost|127\.0\.0\.1)(:|\/|$)/.test(text);
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `${local ? "http" : "https"}://${text}`);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (!isLocal && (url.protocol !== "https:" || !url.hostname.includes("."))) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export default function Widgets() {
  const { can } = useSession();
  const { widgetId } = useParams();
  if (!can("ai", "configure")) return <Navigate to="/" replace />;
  return widgetId ? <WidgetLoader key={widgetId} id={widgetId} /> : <WidgetList />;
}

function Skeleton() {
  return (
    <Card pad={false} className="divide-y divide-line">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 px-5 py-4">
          <div className="size-6 rounded-full bg-hover" />
          <div className="h-3.5 w-48 rounded bg-hover" />
        </div>
      ))}
    </Card>
  );
}

function WidgetList() {
  const org = useOrg();
  const navigate = useNavigate();
  const list = useLoad(() => api.api.v1.organizations({ orgId: org.id }).ai.assistants.get(), [org.id]);
  const chat = useLoad(() => api.api.v1.organizations({ orgId: org.id }).ai["chat-assistant"].get(), [org.id]);
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  const create = async () => {
    setCreating(true);
    const r = await api.api.v1.organizations({ orgId: org.id }).ai.assistants.post({ name: "New widget" });
    setCreating(false);
    if (r.error) return toast.error(messageOf(r.error), "Could not create the widget");
    void navigate(`/widgets/${r.data.id}`, { state: { fresh: true } });
  };
  const newButton = (
    <NewButton disabled={creating} onClick={() => void create()}>
      {creating ? "Creating…" : "New widget"}
    </NewButton>
  );
  const widgets = list.data ?? [];
  const inUse = chat.data?.inUse;
  // A widget the app or a Partner chose belongs to them: it isn't in this list, but it is what the chat button uses.
  const elsewhere = inUse && !widgets.some((a) => a.id === inUse.assistantId) ? inUse : null;

  return (
    <>
      <PageHeader
        title="Widgets"
        sub="Chat for your websites, and for the chat button inside this app. Each widget answers from its own instructions and knowledge."
        actions={newButton}
      />
      <div className="space-y-4">
        <LoadError what="your widgets">{list.error}</LoadError>
        {elsewhere && (
          <p className="rounded-lg bg-hover px-4 py-3 text-[13px] text-muted">
            The chat button in this app uses <b className="font-medium text-fg">{elsewhere.name}</b>, chosen by {levelWho[elsewhere.level]}.
            Open a widget below and choose <b className="font-medium text-fg">Use in the app</b> to use your own instead.
          </p>
        )}
        {list.loading ? (
          <Skeleton />
        ) : widgets.length === 0 ? (
          <Card>
            <Empty
              icon={<MessagesSquare size={22} strokeWidth={1.5} />}
              title="Make your first widget"
              sub="Give it instructions and knowledge, try it in the preview, then paste one line of code into your website."
              action={newButton}
            />
          </Card>
        ) : (
          <Card pad={false} className="divide-y divide-line overflow-hidden">
            {widgets.map((a) => (
              <Link key={a.id} to={`/widgets/${a.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-hover">
                <span className="size-6 shrink-0 rounded-full border border-line" style={{ background: a.widget.accent }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{a.name}</span>
                  <span className="block truncate text-[12.5px] text-muted">
                    {plural(a.widget.allowedOrigins.length, "website")}
                    {modules.knowledge && ` · ${plural(a.knowledgeBaseIds.length, "knowledge base")}`}
                    {` · ${a.model ?? "Default model"}`}
                    {a.builtin && " · Built in"}
                  </span>
                </span>
                {inUse?.assistantId === a.id && <Badge tone="accent">In the app</Badge>}
                <Badge tone={a.widget.enabled ? "good" : "neutral"}>{a.widget.enabled ? "Live" : "Off"}</Badge>
                <ChevronRight size={15} className="shrink-0 text-subtle" />
              </Link>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}

function WidgetLoader({ id }: { id: string }) {
  const org = useOrg();
  const list = useLoad(() => api.api.v1.organizations({ orgId: org.id }).ai.assistants.get(), [org.id]);
  const row = list.data?.find((a) => a.id === id);
  if (list.loading) return <Skeleton />;
  if (!row)
    return (
      <Card>
        <Empty
          icon={<MessagesSquare size={22} strokeWidth={1.5} />}
          title="This widget is gone"
          sub={list.error ?? "It may have been deleted, or it belongs to another organization."}
          action={
            <Link to="/widgets" className="text-[13.5px] underline underline-offset-2">
              Back to Widgets
            </Link>
          }
        />
      </Card>
    );
  return <Editor id={row.id} initial={draftOf(row)} snippet={row.embedCode} builtin={row.builtin} />;
}

function Section({ title, sub, right, children }: { title: string; sub?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4 border-b border-line p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[14px] font-medium">{title}</h2>
          {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

type ChatStatus = {
  inUse: { assistantId: string; name: string; level: ChatLevel };
  own: string | null;
  partner: { assistantId: string; name: string } | null;
  app: { assistantId: string; name: string } | null;
};

/** Whether the chat button inside this app answers as this widget, and the buttons that change that. */
function InApp({
  id,
  name,
  status,
  loadError,
  choose,
}: {
  id: string;
  name: string;
  status: ChatStatus | null;
  loadError: string | null;
  choose: (scope: "organization" | "app", on: boolean) => Promise<string | null>;
}) {
  const { admin, partner } = useSession();
  const fb = useFeedback();
  const [busy, setBusy] = useState(false);
  if (!status) return loadError ? <LoadError what="the app's chat">{loadError}</LoadError> : null;

  const usedHere = status.inUse.assistantId === id;
  const ownHere = status.own === id;
  const appHere = status.app?.assistantId === id;
  const run = async (scope: "organization" | "app", on: boolean, done: string) => {
    setBusy(true);
    fb.clear();
    const err = await choose(scope, on);
    setBusy(false);
    if (err) fb.fail(err, "Could not change it");
    else fb.succeed(done);
  };
  const reach = partner ? "your members and every Client that hasn't chosen its own" : "your members";
  const now = usedHere
    ? {
        organization: `Chosen for ${reach}.`,
        app: "Chosen for everyone in the app.",
        builtin: "The default until you choose another widget.",
        partner: "",
      }[status.inUse.level]
    : `Right now the chat button uses ${status.inUse.name}, chosen by ${levelWho[status.inUse.level]}.`;

  return (
    <Section
      title="Use in the app"
      sub={`The chat button inside this app answers as ${name}: its instructions, knowledge and model.`}
      right={usedHere ? <Badge tone="accent">In the app</Badge> : undefined}
    >
      <p className="text-[13px] text-muted">{now}</p>
      <div className="flex flex-wrap items-center gap-2">
        {ownHere ? (
          <Button disabled={busy} onClick={() => void run("organization", false, "Stopped using it in the app")}>
            Stop using in the app
          </Button>
        ) : (
          <Button variant="primary" disabled={busy} onClick={() => void run("organization", true, "Used in the app")}>
            Use in the app
          </Button>
        )}
        {admin &&
          (appHere ? (
            <Button disabled={busy} onClick={() => void run("app", false, "Stopped using it for everyone")}>
              Stop using for everyone
            </Button>
          ) : (
            <Button disabled={busy} onClick={() => void run("app", true, "Used for everyone in the app")}>
              Use for everyone in the app
            </Button>
          ))}
        <Feedback {...fb.props} />
      </div>
      <p className="text-[12px] text-subtle">
        {`Use in the app reaches ${reach}.`}
        {admin && " Use for everyone reaches every organization that hasn't chosen its own."}
      </p>
    </Section>
  );
}

function Editor({ id, initial, snippet, builtin }: { id: string; initial: Draft; snippet: string; builtin: boolean }) {
  const org = useOrg();
  const navigate = useNavigate();
  const location = useLocation();
  const fresh = (location.state as { fresh?: boolean } | null)?.fresh === true;
  const models = useLoad(() => api.api.v1.organizations({ orgId: org.id }).ai.models.get(), [org.id]);
  const bases = useLoad(
    () =>
      modules.knowledge ? api.api.v1.organizations({ orgId: org.id }).knowledge.bases.get() : Promise.resolve({ data: [], error: null }),
    [org.id],
  );
  const chat = useLoad(() => api.api.v1.organizations({ orgId: org.id }).ai["chat-assistant"].get(), [org.id]);
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const fb = useFeedback();
  const [site, setSite] = useState("");
  const [siteError, setSiteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const siteInput = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const answersChanged =
    draft.instructions !== saved.instructions ||
    draft.model !== saved.model ||
    JSON.stringify(draft.knowledgeBaseIds) !== JSON.stringify(saved.knowledgeBaseIds);
  const setWidget = (w: Partial<Draft["widget"]>) => setDraft((d) => ({ ...d, widget: { ...d.widget, ...w } }));
  const origins = draft.widget.allowedOrigins;
  const shownName = draft.name.trim() || "Your widget";

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const addSite = () => {
    if (!site.trim()) return;
    const origin = toOrigin(site);
    if (!origin) return setSiteError(`"${site.trim()}" isn't a website address. Use https, like example.com.`);
    setSiteError(null);
    setSite("");
    if (!origins.includes(origin)) setWidget({ allowedOrigins: [...origins, origin] });
  };
  const removeSite = (origin: string) => {
    const next = origins.filter((o) => o !== origin);
    // With no website left it can't be live: saving would be refused.
    setWidget({ allowedOrigins: next, enabled: draft.widget.enabled && next.length > 0 });
  };
  const setLive = (on: boolean) => {
    if (on && origins.length === 0) {
      setSiteError("Add a website first. The widget only answers on websites listed here.");
      siteInput.current?.focus();
      return;
    }
    setSiteError(null);
    setWidget({ enabled: on });
  };

  const save = async () => {
    setSaving(true);
    fb.clear();
    const r = await api.api.v1
      .organizations({ orgId: org.id })
      .ai.assistants({ assistantId: id })
      .patch({ ...draft, name: draft.name.trim() });
    setSaving(false);
    if (r.error) return fb.fail(messageOf(r.error));
    const next = draftOf(r.data);
    setSaved(next);
    setDraft(next);
    fb.succeed();
    // Its name, greeting and colour show in the app's chat when this is the widget it uses.
    void chat.reload().then(announceChatAssistantChanged);
  };
  /** Uses this widget in the app, for the Organization (and its Clients) or for everyone, or takes that back. Null: done. */
  const choose = async (scope: "organization" | "app", on: boolean): Promise<string | null> => {
    const assistantId = on ? id : null;
    const r =
      scope === "app"
        ? await api.api.v1.admin.ai["chat-assistant"].put({ assistantId })
        : await api.api.v1.organizations({ orgId: org.id }).ai["chat-assistant"].put({ assistantId });
    if (r.error) return messageOf(r.error);
    await chat.reload();
    announceChatAssistantChanged();
    return null;
  };
  const useFromHeader = async () => {
    const err = await choose("organization", true);
    if (err) toast.error(err, "Could not use it in the app");
    else toast.success("Used in the app", `${shownName} is now the chat button's assistant.`);
  };
  const usedHere = chat.data?.inUse.assistantId === id;
  const remove = async () => {
    if (!confirm(`Delete ${saved.name}? It stops answering on every website. Its past conversations stay.`)) return;
    const r = await api.api.v1.organizations({ orgId: org.id }).ai.assistants({ assistantId: id }).delete();
    if (r.error) return toast.error(messageOf(r.error), "Could not delete");
    void navigate("/widgets");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Select the code and copy it.", "Couldn't reach the clipboard");
    }
  };

  return (
    <>
      <PageHeader
        crumbs={
          <Link to="/widgets" className="hover:text-fg" onClick={(e) => dirty && !confirm("Leave without saving?") && e.preventDefault()}>
            Widgets
          </Link>
        }
        title={shownName}
        actions={
          <>
            <Badge tone={saved.widget.enabled ? "good" : "neutral"}>{saved.widget.enabled ? "Live" : "Off"}</Badge>
            {usedHere ? (
              <Badge tone="accent">In the app</Badge>
            ) : (
              chat.data && (
                <Button variant="primary" size="sm" onClick={() => void useFromHeader()}>
                  Use in the app
                </Button>
              )
            )}
            {!builtin && (
              <Button variant="danger" size="sm" onClick={() => void remove()}>
                Delete
              </Button>
            )}
          </>
        }
      />
      <div className="@container">
        <div className="grid items-start gap-6 @4xl:grid-cols-[minmax(0,1fr)_400px]">
          <Card pad={false}>
            <InApp id={id} name={shownName} status={chat.data} loadError={chat.error} choose={choose} />

            <Section title="What it knows" sub="Who it is, what it should do, and what it answers from.">
              <Field label="Name" hint="Shown at the top of the chat.">
                <Input
                  value={draft.name}
                  maxLength={120}
                  autoFocus={fresh}
                  onFocus={(e) => fresh && e.target.select()}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Instructions" hint="Who it is, what it knows, what to avoid.">
                <Textarea
                  rows={6}
                  maxLength={8000}
                  placeholder="You answer questions for visitors of Maple Dental. Be brief and friendly. Never give medical advice."
                  value={draft.instructions}
                  onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
                />
              </Field>
              <Field label="Model">
                <Select value={draft.model ?? ""} onChange={(e) => setDraft({ ...draft, model: e.target.value || null })}>
                  <option value="">Default{models.data?.default ? ` (${models.data.default})` : ""}</option>
                  {(models.data?.models ?? []).map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {modules.knowledge && (
                <div>
                  <span className="mb-1.5 block text-[12.5px] font-medium text-muted">Knowledge bases</span>
                  <LoadError what="knowledge bases">{bases.error}</LoadError>
                  {!bases.loading && !bases.error && (bases.data ?? []).length === 0 && (
                    <p className="text-[13px] text-muted">
                      None yet.{" "}
                      <Link to="/knowledge" className="text-fg underline underline-offset-2">
                        Create a knowledge base
                      </Link>{" "}
                      to answer from your own documents.
                    </p>
                  )}
                  <div className="space-y-px">
                    {(bases.data ?? []).map((b) => {
                      const on = draft.knowledgeBaseIds.includes(b.id);
                      return (
                        <label key={b.id} className="-mx-2 flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-hover">
                          <Checkbox
                            checked={on}
                            onChange={(checked) =>
                              setDraft({
                                ...draft,
                                knowledgeBaseIds: checked
                                  ? [...draft.knowledgeBaseIds, b.id]
                                  : draft.knowledgeBaseIds.filter((x) => x !== b.id),
                              })
                            }
                          />
                          <span className="min-w-0 flex-1 truncate text-[13.5px]">{b.name}</span>
                          <span className="num text-[12.5px] text-muted">{plural(b.documents, "document")}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </Section>

            <Section title="How it looks">
              <Field label="Greeting" hint="The first thing a visitor reads.">
                <Input value={draft.widget.greeting} maxLength={200} onChange={(e) => setWidget({ greeting: e.target.value })} />
              </Field>
              <Field label="Colour" hint="The button and the visitor's messages.">
                <span className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Pick a colour"
                    value={HEX.test(draft.widget.accent) ? draft.widget.accent : "#000000"}
                    onChange={(e) => setWidget({ accent: e.target.value })}
                    className="size-9 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-1"
                  />
                  <Input
                    aria-label="Colour as a hex code"
                    className="w-28 font-mono"
                    value={draft.widget.accent}
                    maxLength={7}
                    onChange={(e) => setWidget({ accent: e.target.value })}
                  />
                </span>
              </Field>
            </Section>

            <Section
              title="Where it answers"
              sub="Only these websites can use this widget. Anywhere else, it doesn't appear."
              right={
                <span className="flex items-center gap-2 text-[13px] text-muted">
                  {draft.widget.enabled ? "Live" : "Off"}
                  <Toggle checked={draft.widget.enabled} onChange={setLive} label="Widget is live on these websites" />
                </span>
              }
            >
              <div>
                <div className="flex gap-2">
                  <Input
                    ref={siteInput}
                    aria-label="Website address"
                    aria-invalid={!!siteError}
                    aria-describedby={siteError ? "site-error" : undefined}
                    placeholder="example.com"
                    value={site}
                    onChange={(e) => {
                      setSite(e.target.value);
                      setSiteError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSite();
                      }
                    }}
                    onBlur={addSite}
                  />
                  <Button onClick={addSite}>Add</Button>
                </div>
                {siteError ? (
                  <p id="site-error" className="mt-1 text-[12.5px] text-bad">
                    {siteError}
                  </p>
                ) : (
                  <p className="mt-1 text-[12px] text-subtle">www.example.com counts as a separate website from example.com.</p>
                )}
              </div>
              {origins.length > 0 && (
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {origins.map((o) => (
                    <li key={o} className="flex items-center justify-between gap-3 py-1 pr-1 pl-3">
                      <span className="min-w-0 truncate text-[13.5px]">{o}</span>
                      <button
                        type="button"
                        onClick={() => removeSite(o)}
                        aria-label={`Remove ${o}`}
                        className="grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-hover hover:text-fg"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[12.5px] font-medium text-muted">Add it to your website</span>
                  <Button size="sm" variant="ghost" icon={copied ? <Check size={13} /> : <Copy size={13} />} onClick={() => void copy()}>
                    {copied ? "Copied" : "Copy code"}
                  </Button>
                </div>
                <pre className="rounded-lg bg-hover p-3 font-mono text-[12px] leading-[1.6] break-all whitespace-pre-wrap">{snippet}</pre>
                <p className="mt-1 text-[12px] text-subtle">
                  {saved.widget.enabled
                    ? "Paste it before the closing body tag on any page of the websites above."
                    : "Paste it before the closing body tag. The button appears once this widget is live and saved."}
                </p>
              </div>
            </Section>

            <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-b-xl bg-surface px-5 py-3">
              <div className="min-w-0 flex-1">
                <Feedback {...fb.props} />
                {!fb.props.message && <p className="text-[13px] text-muted">{dirty ? "Unsaved changes" : "All changes saved"}</p>}
              </div>
              <Button variant="primary" disabled={!dirty || saving || !draft.name.trim()} onClick={() => void save()}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </Card>

          <Preview
            orgId={org.id}
            widgetId={id}
            name={shownName}
            greeting={draft.widget.greeting}
            accent={HEX.test(draft.widget.accent) ? draft.widget.accent : saved.widget.accent}
            host={origins[0] ? new URL(origins[0]).host : "your-website.com"}
            stale={answersChanged}
          />
        </div>
      </div>
    </>
  );
}

/** The real widget on a stand-in page. Its look follows the form as you type; its answers use what's saved. */
function Preview({
  orgId,
  widgetId,
  name,
  greeting,
  accent,
  host,
  stale,
}: {
  orgId: string;
  widgetId: string;
  name: string;
  greeting: string;
  accent: string;
  host: string;
  stale: boolean;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const chat = useRef<ChatHandle | null>(null);

  useEffect(() => {
    const el = document.createElement("div");
    stage.current!.appendChild(el);
    const mounted = mountChat(el, {
      backend: memberBackend(orgId, widgetId),
      name: "",
      greeting: "",
      maxLength: 2000,
      launcher: true,
      stage: true,
      startOpen: true,
    });
    chat.current = mounted;
    return () => {
      mounted.destroy();
      el.remove();
      chat.current = null;
    };
  }, [orgId, widgetId]);

  useEffect(() => {
    chat.current?.configure({ name, greeting, theme: { ...accentTheme(accent), "--cw-z": "1" } });
  }, [name, greeting, accent]);

  return (
    <div className="@4xl:sticky @4xl:top-8">
      <div className="relative isolate h-[min(640px,calc(100dvh-7rem))] min-h-[520px] overflow-hidden rounded-xl border border-line bg-hover">
        <div className="flex h-9 items-center gap-2 border-b border-line bg-surface px-3">
          <span className="text-[12.5px] font-medium">Preview</span>
          <span className="min-w-0 truncate rounded bg-hover px-2 py-0.5 text-[12px] text-muted">{host}</span>
        </div>
        <div ref={stage} className="absolute inset-x-0 top-9 bottom-0" />
      </div>
      <p className="mt-2 text-[12.5px] text-muted">
        {stale
          ? "Save to test your changes: answers use the last saved settings."
          : "A real chat with this widget. It counts toward your usage."}
      </p>
    </div>
  );
}

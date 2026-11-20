// Settings, one page for everything that isn't day-to-day work (ADR 0027). Four groups: the open Organization, shared
// by everyone on it; its Partner side, when it's a Partner; You, which follows the person to every Organization; and,
// for app admins, the app itself. Sections of a module that's off don't exist.
import { lazy, Suspense, useState, type ComponentType, type FormEvent } from "react";
import { Link, Navigate, NavLink, useParams } from "react-router";
import {
  Archive,
  BookOpen,
  Bot,
  Building,
  Building2,
  Cable,
  ChevronLeft,
  Cpu,
  CreditCard,
  Handshake,
  Mail,
  Paintbrush,
  Palette,
  Plug,
  SlidersHorizontal,
  ToggleRight,
  UserRound,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Badge, Button, Card, Field, Input, MenuGroup, MenuLink, PageHeader, RailGroup, Select, Toggle } from "../components/ui";
import { Table } from "../components/Table";
import { Feedback, useFeedback, useToast } from "../components/Feedback";
import { api, fmtDate, messageOf } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { useMediaQuery } from "../lib/useMediaQuery";
import { useOrg, useSession } from "../lib/session";
import Appearance from "./settings/Appearance";
import Profile from "./settings/Profile";
import Team from "./settings/Team";
import { navRow, railGroups } from "../components/ui";

const Billing = __MODULE_BILLING__ ? lazy(() => import("./settings/Billing")) : null;
const Clients = __MODULE_PARTNERS__ ? lazy(() => import("./settings/Clients")) : null;
const Whitelabel = __MODULE_PARTNERS__ ? lazy(() => import("./settings/Whitelabel")) : null;

type Can = (r: string, a: string) => boolean;
type Section = {
  id: string;
  label: string;
  icon: LucideIcon;
  page: ComponentType;
  /** The line under the heading. A section without one draws its own heading, to put actions beside it. */
  sub?: string;
  when?: (can: Can) => boolean;
};

const organizationSections: Section[] = [
  { id: "general", label: "General", icon: Building2, page: General, sub: "Name and time zone." },
  {
    id: "features",
    label: "Features",
    icon: ToggleRight,
    page: Features,
    sub: "Turn parts of the app on and off for this organization. Nothing is deleted when something is off.",
    when: (can) => can("setup", "view"),
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: Plug,
    page: Integrations,
    sub: "Connect the services this organization uses.",
    when: (can) => can("setup", "view"),
  },
  { id: "team", label: "Team", icon: UsersRound, page: Team },
  ...(Billing
    ? [
        {
          id: "billing",
          label: "Billing",
          icon: CreditCard,
          page: Billing,
          sub: "The plan this organization is on, what it allows, and the plans it could move to.",
          when: (can: Can) => can("billing", "view"),
        },
      ]
    : []),
  {
    id: "danger",
    label: "Archive & delete",
    icon: Archive,
    page: Danger,
    sub: "Archiving hides the organization from everyone. It can be undone. Deleting is for an archived organization and removes everything.",
    when: (can) => can("organization", "delete"),
  },
];

const partnerSections: Section[] =
  Clients && Whitelabel
    ? [
        { id: "clients", label: "Clients", icon: Handshake, page: Clients },
        { id: "whitelabel", label: "Whitelabel", icon: Paintbrush, page: Whitelabel, when: (can) => can("organization", "update") },
      ]
    : [];

const yourSections: Section[] = [
  { id: "profile", label: "Profile", icon: UserRound, page: Profile, sub: "How teammates see you." },
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
    page: Appearance,
    sub: "Saved on this device. The moon in the sidebar switches it too.",
  },
];

// Lazy, so people who aren't app admins never download them. The API guards each one too.
const adminSections: Section[] = [
  { id: "admin-users", label: "Users", icon: Users, page: lazy(() => import("./admin/Users")), sub: "Every account in the app." },
  {
    id: "admin-organizations",
    label: "Organizations",
    icon: Building,
    page: lazy(() => import("./admin/Organizations")),
    sub: "Every organization in the app.",
  },
  {
    id: "admin-connections",
    label: "Connections",
    icon: Cable,
    page: lazy(() => import("./admin/Connections")),
    sub: "The app's own provider accounts, used wherever an organization hasn't connected its own.",
  },
  {
    id: "admin-email",
    label: "Email",
    icon: Mail,
    page: lazy(() => import("./admin/Email")),
    sub: "Whether the app can send email, and a test send.",
  },
  ...(__MODULE_BILLING__
    ? [
        {
          id: "admin-plans",
          label: "Plans & usage",
          icon: CreditCard,
          page: lazy(() => import("./admin/Plans")),
          sub: "What each plan grants and meters, and what organizations used.",
        },
      ]
    : []),
  {
    id: "admin-settings",
    label: "App settings",
    icon: SlidersHorizontal,
    page: lazy(() => import("./admin/AppSettings")),
    sub: "The settings each module declares for the whole app.",
  },
  ...(__MODULE_AI__
    ? [
        {
          id: "admin-models",
          label: "Models",
          icon: Cpu,
          page: lazy(() => import("./admin/Models")),
          sub: "Vendor keys, the models each offers, the app's model names and its default.",
        },
        {
          id: "admin-assistants",
          label: "Assistants",
          icon: Bot,
          page: lazy(() => import("./admin/Assistants")),
          sub: "Every assistant across organizations.",
        },
      ]
    : []),
  ...(__MODULE_KNOWLEDGE__
    ? [
        {
          id: "admin-knowledge",
          label: "Knowledge",
          icon: BookOpen,
          page: lazy(() => import("./admin/KnowledgeAdmin")),
          sub: "Every knowledge base across organizations.",
        },
      ]
    : []),
];

/** The groups the person can see, in order: the open Organization, its Partner, You, the app. Rail and menu share them. */
function useSettingsGroups() {
  const org = useOrg();
  const { can, partner, admin } = useSession();
  const visible = (items: Section[]) => items.filter((s) => !s.when || s.when(can));
  return [
    {
      id: "organization",
      title: org.name,
      hint: `Organization settings, shared by everyone on ${org.name}`,
      sections: visible(organizationSections),
    },
    ...(partner && partnerSections.length > 0
      ? [{ id: "partner", title: partner.name, hint: "Partner settings, for every client", sections: visible(partnerSections) }]
      : []),
    { id: "you", title: "You", hint: "Just for you, in every organization", sections: visible(yourSections) },
    ...(admin ? [{ id: "admin", title: "App admin", hint: "The whole app, not this organization", sections: visible(adminSections) }] : []),
  ];
}

/** The side rail, on wide screens. */
function SettingsNav() {
  const groups = useSettingsGroups();
  return (
    <nav aria-label="Settings" className={railGroups}>
      {groups.map((g) => (
        <RailGroup key={g.id} title={g.title} hint={g.hint}>
          {g.sections.map((s) => (
            <NavLink key={s.id} to={`/settings/${s.id}`} className={({ isActive }) => navRow(isActive)}>
              <s.icon size={14} strokeWidth={1.75} className="shrink-0" />
              {s.label}
            </NavLink>
          ))}
        </RailGroup>
      ))}
    </nav>
  );
}

/** What /settings shows on a phone: every section in its group, one tap from its page. */
function SettingsMenu() {
  const groups = useSettingsGroups();
  return (
    <>
      <PageHeader title="Settings" />
      <nav aria-label="Settings" className="max-w-xl space-y-6">
        {groups.map((g) => (
          <MenuGroup key={g.id} title={g.title} hint={g.hint}>
            {g.sections.map((s) => (
              <MenuLink key={s.id} to={`/settings/${s.id}`} icon={<s.icon size={16} strokeWidth={1.75} />}>
                {s.label}
              </MenuLink>
            ))}
          </MenuGroup>
        ))}
      </nav>
    </>
  );
}

export default function Settings() {
  const { section } = useParams();
  const { admin } = useSession();
  const wide = useMediaQuery("(min-width: 1024px)");
  // The rail lists the sections beside the page; without a rail, /settings is the list itself.
  if (!section) return wide ? <Navigate replace to="/settings/general" /> : <SettingsMenu />;
  // Looked up among all sections: a Role's permissions may still be loading when a link opens one.
  const found = [...organizationSections, ...partnerSections, ...yourSections, ...adminSections].find((s) => s.id === section);
  if (!found || (adminSections.includes(found) && !admin)) return <Navigate replace to="/settings/general" />;
  return (
    <div className="grid gap-6 lg:grid-cols-[184px_minmax(0,1fr)] lg:gap-10">
      <SettingsNav />
      <div className="min-w-0">
        <Link
          to="/settings"
          className="mb-3 -ml-1 inline-flex h-9 items-center gap-0.5 rounded-md pr-2 text-[13px] text-muted hover:text-fg lg:hidden"
        >
          <ChevronLeft size={16} />
          Settings
        </Link>
        {found.sub && <PageHeader title={found.label} sub={found.sub} />}
        <Suspense fallback={null}>
          <found.page />
        </Suspense>
      </div>
    </div>
  );
}

function General() {
  const org = useOrg();
  const { can, refresh } = useSession();
  const details = useLoad(() => api.api.v1.organizations({ orgId: org.id }).get(), [org.id]);
  const [name, setName] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const fb = useFeedback();
  const zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? ["UTC"];
  const save = async (e: FormEvent) => {
    e.preventDefault();
    fb.clear();
    const r = await api.api.v1.organizations({ orgId: org.id }).patch({
      name: name ?? details.data?.name,
      timezone: timezone ?? details.data?.timezone ?? "UTC",
    });
    if (r.error) return fb.fail(messageOf(r.error));
    fb.succeed();
    await refresh();
    void details.reload();
  };
  if (!details.data) return null;
  return (
    <Card className="max-w-3xl">
      <form onSubmit={save}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input
              size="lg"
              value={name ?? details.data.name}
              onChange={(e) => (fb.clear(), setName(e.target.value))}
              disabled={!can("organization", "update")}
            />
          </Field>
          <Field label="Short name" hint="Fixed once made.">
            <Input size="lg" value={details.data.slug} disabled />
          </Field>
          <Field label="Time zone">
            <Select
              size="lg"
              value={timezone ?? details.data.timezone ?? "UTC"}
              onChange={(e) => (fb.clear(), setTimezone(e.target.value))}
              disabled={!can("organization", "update")}
            >
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {can("organization", "update") && (
          <div className="mt-5 flex items-center justify-end gap-4 border-t border-line pt-4">
            <Feedback {...fb.props} />
            <Button type="submit" variant="primary">
              Save
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}

function Features() {
  const org = useOrg();
  const { can, reloadFeatures } = useSession();
  const features = useLoad(() => api.api.v1.organizations({ orgId: org.id }).features.get(), [org.id]);
  const toast = useToast();
  const toggle = async (id: string, on: boolean) => {
    const r = await api.api.v1.organizations({ orgId: org.id }).features.patch({ [id]: on });
    if (r.error) return toast.error(messageOf(r.error), "Could not change the switch");
    void features.reload();
    await reloadFeatures();
  };
  const list = Object.entries((features.data ?? {}) as Record<string, { on: boolean; why?: string; label: string; description: string }>);
  if (!features.data) return null;
  return (
    <div className="max-w-3xl space-y-4">
      <Card pad={false}>
        {list.length === 0 && <p className="px-5 py-4 text-[13px] text-muted">This app has no feature switches yet (app.config.ts).</p>}
        <ul className="divide-y divide-line">
          {list.map(([id, f]) => {
            const locked = !!f.why && f.why !== "turned off";
            return (
              <li key={id} className="flex items-center justify-between gap-4 px-5 py-4">
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium">{f.label}</span>
                  <span className="block text-[12.5px] text-muted">{f.description}</span>
                  {locked && (
                    <Badge tone="warn" className="mt-1.5">
                      {f.why}
                    </Badge>
                  )}
                </span>
                <Toggle checked={f.on} onChange={(on) => void toggle(id, on)} label={f.label} />
                {!can("organization", "update") && <span className="sr-only">read only</span>}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

type Provider = {
  id: string;
  name: string;
  vendor: string | null;
  mark: string;
  color: string;
  category: string;
  blurb: string;
  capabilities: string[];
  fields: {
    key: string;
    label: string;
    secret?: boolean;
    placeholder?: string;
    options?: string[];
    optional?: boolean;
  }[];
};

/** Connect forms from the catalog; this is also what App admin → Connections uses for the app's own accounts. */
export function ConnectForm({
  provider,
  onSubmit,
  onCancel,
}: {
  provider: Provider;
  onSubmit: (label: string, values: Record<string, string>) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(provider.name);
  const [values, setValues] = useState<Record<string, string>>({});
  const fb = useFeedback();
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const err = await onSubmit(label, values);
    setBusy(false);
    if (err) fb.fail(err, "Could not connect");
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Label">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} />
      </Field>
      {provider.fields.map((f) => (
        <Field key={f.key} label={f.label + (f.optional ? " (optional)" : "")}>
          {f.options ? (
            <Select value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
              <option value="">—</option>
              {f.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              type={f.secret ? "password" : "text"}
              placeholder={f.placeholder}
              required={!f.optional}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            />
          )}
        </Field>
      ))}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Feedback {...fb.props} className="basis-full" />
        <Button type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Connecting…" : "Connect"}
        </Button>
      </div>
    </form>
  );
}

export function ProviderMark({ p, size = 32 }: { p: Pick<Provider, "mark" | "color">; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-lg font-semibold text-white"
      style={{
        width: size,
        height: size,
        background: p.color,
        fontSize: size * 0.36,
      }}
      aria-hidden
    >
      {p.mark}
    </span>
  );
}

function Integrations() {
  const org = useOrg();
  const { can } = useSession();
  const providers = useLoad(() => api.api.v1.organizations({ orgId: org.id }).connections.providers.get(), [org.id]);
  const connections = useLoad(() => api.api.v1.organizations({ orgId: org.id }).connections.get(), [org.id]);
  const [connecting, setConnecting] = useState<Provider | null>(null);
  const toast = useToast();
  const list = (providers.data ?? []) as Provider[];
  const categories = [...new Set(list.map((p) => p.category))];
  const connectedBy = new Map((connections.data ?? []).map((c) => [c.providerId, c]));

  const connect = async (label: string, values: Record<string, string>) => {
    const r = await api.api.v1.organizations({ orgId: org.id }).connections.post({ providerId: connecting!.id, label, values });
    if (r.error) return messageOf(r.error);
    setConnecting(null);
    void connections.reload();
    return null;
  };
  const disconnect = async (id: string) => {
    if (!confirm("Disconnect this provider?")) return;
    const r = await api.api.v1.organizations({ orgId: org.id }).connections({ connectionId: id }).delete();
    if (r.error) return toast.error(messageOf(r.error), "Could not disconnect");
    void connections.reload();
  };

  return (
    <div className="max-w-3xl space-y-6">
      {categories.map((cat) => (
        <section key={cat}>
          <h2 className="mb-2 text-[14px] font-medium">{cat}</h2>
          <Card pad={false}>
            <ul className="divide-y divide-line">
              {list
                .filter((p) => p.category === cat)
                .map((p) => {
                  const c = connectedBy.get(p.id);
                  return (
                    <li key={p.id} className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <ProviderMark p={p} />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 text-[14px] font-medium">
                            {p.name}
                            {c && (
                              <Badge tone={c.mode === "live" ? "good" : "neutral"}>
                                {c.mode === "live" ? "connected" : "connected · stub"}
                              </Badge>
                            )}
                          </span>
                          <span className="block text-[12.5px] text-muted">{c ? c.label : p.blurb}</span>
                        </span>
                        {can("setup", "connect") &&
                          (c ? (
                            <Button size="sm" variant="ghost" onClick={() => void disconnect(c.id)}>
                              Disconnect
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => setConnecting(connecting?.id === p.id ? null : p)}>
                              Connect
                            </Button>
                          ))}
                      </div>
                      {connecting?.id === p.id && (
                        <div className="mt-4 max-w-md sm:ml-11">
                          <ConnectForm provider={p} onSubmit={connect} onCancel={() => setConnecting(null)} />
                        </div>
                      )}
                    </li>
                  );
                })}
            </ul>
          </Card>
        </section>
      ))}
      {connections.data && connections.data.length > 0 && (
        <section>
          <h2 className="mb-2 text-[14px] font-medium">Connected</h2>
          <Table
            head={["Connection", "Provider", "Mode", "Since"]}
            rows={connections.data.map((c) => [
              c.label,
              c.providerId,
              <Badge key="m" tone={c.mode === "live" ? "good" : "neutral"}>
                {c.mode}
              </Badge>,
              fmtDate(c.createdAt as unknown as string),
            ])}
          />
        </section>
      )}
    </div>
  );
}

function Danger() {
  const org = useOrg();
  const { refresh, organizations } = useSession();
  const toast = useToast();
  const archive = async () => {
    if (!confirm(`Archive ${org.name}? Members lose access until it's unarchived.`)) return;
    const r = await api.api.v1.organizations({ orgId: org.id }).archive.post();
    if (r.error) return toast.error(messageOf(r.error), "Could not archive");
    await refresh();
  };
  return (
    <div className="max-w-3xl space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1 basis-64">
          <div className="text-[14px] font-medium">Archive this organization</div>
          <div className="text-[12.5px] text-muted">
            {organizations.length < 2
              ? "Make or join another organization first, so you have somewhere to go."
              : "Members lose access until it's unarchived."}
          </div>
        </div>
        <Button variant="danger" size="sm" onClick={() => void archive()} disabled={organizations.length < 2}>
          Archive
        </Button>
      </Card>
    </div>
  );
}

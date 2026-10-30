import { useEffect, useRef, useState } from "react";
import { Navigate, NavLink, useParams } from "react-router";
import {
  Store, SearchCheck, BarChart3, Globe, Hash, Check, AudioLines, Puzzle, MapPin, Plug, Zap, Users, History,
  UserRound, Palette, Bell, CreditCard, Sun, Moon, Monitor,
} from "lucide-react";
import { Badge, Button, Card, CardHeader, PageHeader, Progress, Toggle, cn } from "../components/ui";
import { locations } from "../data/mock";
import { brandFacts } from "../data/brand";
import { channels } from "../data/social";
import { ChannelBadge } from "../components/Social";
import { setThemeMode, useThemeMode, type ThemeMode } from "../lib/theme";
import Brand from "./Brand";
import Skills from "./Skills";
import Runs from "./Runs";

// Two scopes, one rule: Business settings are shared by everyone who works on
// the business and travel with it (voice, skills, connections, who has access).
// Account settings belong to the signed-in person and follow them to every
// business they open (sign-in, theme, notifications, the plan they pay for).
type Section = { id: string; label: string; icon: typeof Store; page: () => React.JSX.Element };

export const businessSections: Section[] = [
  { id: "brand", label: "Brand voice", icon: AudioLines, page: Brand },
  { id: "skills", label: "Marko skills", icon: Puzzle, page: Skills },
  { id: "locations", label: "Locations", icon: MapPin, page: Locations },
  { id: "integrations", label: "Integrations", icon: Plug, page: Integrations },
  { id: "automation", label: "Automation", icon: Zap, page: Automation },
  { id: "team", label: "Team", icon: Users, page: Team },
  { id: "activity", label: "Activity", icon: History, page: Runs },
];
export const accountSections: Section[] = [
  { id: "profile", label: "Profile", icon: UserRound, page: AccountProfile },
  { id: "appearance", label: "Appearance", icon: Palette, page: Appearance },
  { id: "notifications", label: "Notifications", icon: Bell, page: Notifications },
  { id: "billing", label: "Plan & billing", icon: CreditCard, page: Billing },
];

function SubNav() {
  const ref = useRef<HTMLElement>(null);
  const { section } = useParams();
  // On narrow screens the sections are a scrolling strip; keep the current one in view.
  useEffect(() => { ref.current?.querySelector("[aria-current=page]")?.scrollIntoView({ block: "nearest", inline: "center" }); }, [section]);
  const link = (s: Section) => (
    <NavLink key={s.id} to={`/settings/${s.id}`} className={({ isActive }) => cn("flex h-7 shrink-0 items-center gap-2 rounded-md px-2 text-[13px] whitespace-nowrap transition-colors", isActive ? "bg-active font-medium text-fg" : "text-muted hover:bg-hover hover:text-fg")}>
      <s.icon size={14} strokeWidth={1.75} className="shrink-0" />{s.label}
    </NavLink>
  );
  const group = (title: string, hint: string, items: Section[]) => (
    <div className="flex shrink-0 items-center gap-1 lg:flex-col lg:items-stretch lg:gap-px">
      <div className="hidden px-2 pb-1 lg:block">
        <div className="truncate text-[11px] font-medium tracking-[0.06em] text-subtle uppercase">{title}</div>
        <div className="text-[11.5px] leading-snug text-subtle">{hint}</div>
      </div>
      {items.map(link)}
    </div>
  );
  return (
    <nav ref={ref} aria-label="Settings" className="-mx-4 flex gap-4 overflow-x-auto border-b border-line px-4 pb-2 lg:sticky lg:top-6 lg:mx-0 lg:flex-col lg:gap-6 lg:self-start lg:overflow-visible lg:border-0 lg:p-0">
      {group("Business", `Shared by everyone on ${brandFacts.name}`, businessSections)}
      <span aria-hidden className="w-px shrink-0 self-stretch bg-line lg:hidden" />
      {group("Account", "Just for you, in every business", accountSections)}
    </nav>
  );
}

export default function Settings() {
  const { section } = useParams();
  const found = [...businessSections, ...accountSections].find((s) => s.id === section);
  if (!found) return <Navigate replace to="/settings/brand" />;
  const Page = found.page;
  return (
    <div className="grid gap-6 lg:grid-cols-[184px_minmax(0,1fr)] lg:gap-10">
      <SubNav />
      <div className="min-w-0"><Page /></div>
    </div>
  );
}

const integrations = [
  { icon: Store, name: "Google Business Profile", status: "Connected", detail: "2 locations · business.manage", ok: true },
  { icon: SearchCheck, name: "Google Search Console", status: "Connected", detail: "sc-domain:mapleandmaindental.com", ok: true },
  { icon: BarChart3, name: "Google Analytics 4", status: "Not connected", detail: "Attribute calls & bookings to SEO", ok: false },
  { icon: Globe, name: "WordPress", status: "Connected", detail: "Application password · Yoast detected", ok: true },
  { icon: Hash, name: "Slack", status: "Not connected", detail: "Alerts and weekly digests", ok: false },
];

function Integrations() {
  return (
    <>
      <PageHeader title="Integrations" sub={`Accounts ${brandFacts.name} is connected to. Everyone on the team works through these.`} />
      <div className="max-w-3xl space-y-6">
        <Card pad={false}>
          {integrations.map((i) => (
            <div key={i.name} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
              <span className="grid size-9 place-items-center rounded-lg bg-hover"><i.icon size={16} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[14px] font-medium">{i.name}{i.ok && <Badge tone="good"><Check size={10} /> {i.status}</Badge>}</div>
                <div className="truncate text-[12.5px] text-muted">{i.detail}</div>
              </div>
              <Button size="sm" variant={i.ok ? "ghost" : "primary"}>{i.ok ? "Manage" : "Connect"}</Button>
            </div>
          ))}
        </Card>
        <Card pad={false}>
          <div className="border-b border-line px-5 py-3 text-[13px] font-medium text-muted">Social accounts</div>
          {channels.filter((c) => c.id !== "google").map((c) => (
            <div key={c.id} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
              <ChannelBadge id={c.id} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[14px] font-medium">{c.name}{c.connected && <Badge tone="good"><Check size={10} /> Connected</Badge>}</div>
                <div className="truncate text-[12.5px] text-muted">{c.connected ? `${c.handle} · ${c.followers.toLocaleString()} followers` : "Post and schedule from Posts & calendar"}</div>
              </div>
              <Button size="sm" variant={c.connected ? "ghost" : "primary"}>{c.connected ? "Manage" : "Connect"}</Button>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

function Locations() {
  return (
    <>
      <PageHeader title="Locations" sub={`Each location has its own keywords and grid scans, and shares ${brandFacts.name}'s voice and skills.`} actions={<NavLink to="/onboarding"><Button size="sm">Add location</Button></NavLink>} />
      <Card pad={false} className="max-w-3xl">
        {locations.map((l, i) => (
          <div key={l.id} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
            <div className="min-w-0 flex-1"><div className="text-[14px] font-medium">{l.name}</div><div className="text-[12.5px] text-muted">{l.city} · {i ? "9" : "16"} keywords · 7×7 grid weekly</div></div>
            <Button size="sm" variant="ghost">Edit</Button>
          </div>
        ))}
      </Card>
    </>
  );
}

function Automation() {
  const [auto, setAuto] = useState({ posts: true, alt: true, schema: false, categories: false, replies: false });
  return (
    <>
      <PageHeader title="Automation" sub="What OpenMarko can change without asking. Everything else waits in To-do for approval." />
      <Card className="max-w-3xl">
        {([
          ["posts", "Publish scheduled GBP posts", "Low risk"],
          ["alt", "Write image alt text on your site", "Low risk"],
          ["schema", "Add or update structured data", "Medium risk"],
          ["categories", "Change GBP categories or description", "High risk. Can trigger re-verification"],
          ["replies", "Reply to reviews", "Always reviewed by a person (recommended)"],
        ] as const).map(([k, l, d]) => (
          <div key={k} className="flex items-center gap-4 border-t border-line py-3.5 first:border-0 first:pt-0 last:pb-0">
            <div className="flex-1"><div className="text-[14px]">{l}</div><div className="text-[12.5px] text-muted">{d}</div></div>
            <Toggle label={l} checked={auto[k]} onChange={(v) => setAuto({ ...auto, [k]: v })} />
          </div>
        ))}
      </Card>
    </>
  );
}

function Team() {
  return (
    <>
      <PageHeader title="Team" sub={`Who can open ${brandFacts.name}, and what they can change.`} actions={<Button size="sm">Invite teammate</Button>} />
      <Card pad={false} className="max-w-3xl">
        {[["Dr. Anika Patel", "Owner"], ["Sam Ortiz", "Marketing · Editor"], ["Agency partner", "Viewer"]].map(([n, r]) => (
          <div key={n} className="flex items-center gap-3 border-b border-line px-5 py-3.5 last:border-0">
            <span className="grid size-8 place-items-center rounded-full bg-hover text-[12px] font-medium">{n.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
            <span className="flex-1 text-[14px]">{n}</span>
            <span className="text-[12.5px] text-muted">{r}</span>
          </div>
        ))}
      </Card>
    </>
  );
}

function AccountProfile() {
  const field = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-[13.5px] outline-none focus:border-line-strong";
  return (
    <>
      <PageHeader title="Profile" sub="How you sign in and how teammates see you." />
      <Card className="max-w-3xl">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-hover text-[15px] font-medium">AP</span>
          <Button size="sm" variant="ghost">Change photo</Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-[12.5px] font-medium text-muted">Name</span><input defaultValue="Dr. Anika Patel" className={field} /></label>
          <label className="block"><span className="mb-1.5 block text-[12.5px] font-medium text-muted">Email</span><input defaultValue="anika@mapleandmaindental.com" className={field} /></label>
        </div>
        <div className="mt-5 flex items-center gap-4 border-t border-line pt-4">
          <div className="flex-1"><div className="text-[14px]">Sign-in</div><div className="text-[12.5px] text-muted">Google · last signed in today</div></div>
          <Button size="sm" variant="ghost">Manage</Button>
        </div>
      </Card>
    </>
  );
}

function Appearance() {
  const mode = useThemeMode();
  const options: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "Match system", icon: Monitor },
  ];
  return (
    <>
      <PageHeader title="Appearance" sub="Saved on this device. The moon in the sidebar switches it too." />
      <div role="radiogroup" aria-label="Theme" className="grid max-w-3xl gap-3 sm:grid-cols-3">
        {options.map((o) => (
          <button key={o.id} role="radio" aria-checked={mode === o.id} onClick={() => setThemeMode(o.id)} className={cn("flex items-center gap-2.5 rounded-xl border bg-surface p-4 text-left text-[14px] shadow-card transition-colors", mode === o.id ? "border-ink" : "border-line hover:border-line-strong")}>
            <o.icon size={16} strokeWidth={1.75} className="text-muted" />
            <span className="flex-1">{o.label}</span>
            {mode === o.id && <Check size={14} />}
          </button>
        ))}
      </div>
    </>
  );
}

function Notifications() {
  const [on, setOn] = useState({ digest: true, drops: true, reviews: true, approvals: true, product: false });
  return (
    <>
      <PageHeader title="Notifications" sub="What OpenMarko emails you about, for every business you're on." />
      <Card className="max-w-3xl">
        {([
          ["digest", "Weekly digest", "Rankings, reviews and what Marko did, every Monday"],
          ["drops", "Ranking drops", "When a tracked keyword falls out of the top 3"],
          ["reviews", "New reviews", "Within the hour, with a suggested reply"],
          ["approvals", "Waiting for you", "When something in To-do needs your approval"],
          ["product", "Product updates", "New features, about once a month"],
        ] as const).map(([k, l, d]) => (
          <div key={k} className="flex items-center gap-4 border-t border-line py-3.5 first:border-0 first:pt-0 last:pb-0">
            <div className="flex-1"><div className="text-[14px]">{l}</div><div className="text-[12.5px] text-muted">{d}</div></div>
            <Toggle label={l} checked={on[k]} onChange={(v) => setOn({ ...on, [k]: v })} />
          </div>
        ))}
      </Card>
    </>
  );
}

function Billing() {
  return (
    <>
      <PageHeader title="Plan & billing" sub="Your plan covers every business and location on your account." />
      <Card className="max-w-3xl">
        <CardHeader title="Growth plan" sub="$79 / month · renews Nov 14" right={<Button size="sm">Change plan</Button>} />
        {[["Tracked keywords", 16, 25], ["Locations", 2, 3], ["Grid scans this month", 38, 100], ["Auto-applied changes", 11, 50]].map(([l, u, t]) => (
          <div key={l as string} className="mt-4">
            <div className="mb-1.5 flex justify-between text-[13px]"><span>{l}</span><span className="num text-muted">{u} / {t}</span></div>
            <Progress value={((u as number) / (t as number)) * 100} />
          </div>
        ))}
      </Card>
    </>
  );
}

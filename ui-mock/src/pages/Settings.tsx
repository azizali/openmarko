import { useEffect, useRef, useState } from "react";
import { Navigate, NavLink, useParams } from "react-router";
import {
  Store, SearchCheck, BarChart3, Globe, Hash, Check, AudioLines, Puzzle, MapPin, Plug, Zap, Users, History,
  UserRound, Palette, Bell, Building2, Paintbrush, CreditCard, Sun, Moon, Monitor, Plus, AtSign, Send, Copy, Webhook, AlertTriangle, Megaphone, ToggleRight, CalendarClock, Mail, MessageSquareText, Phone, ShieldCheck,
} from "lucide-react";
import { Badge, Button, Card, CardHeader, PageHeader, Progress, Toggle, cn, useToast } from "../components/ui";
import { locations, member } from "../data/mock";
import { brandFacts } from "../data/brand";
import { accounts, platformMeta, type SocialPlatform } from "../data/social";
import { PlatformMark } from "../components/Social";
import { memberships, organization, shortLocation, websites } from "../data/org";
import { useScope } from "../lib/scope";
import { accountConnected, setAccount, setGoogleProfile, setWebsite, useSetup } from "../lib/setup";
import { setThemeMode, useThemeMode, type ThemeMode } from "../lib/theme";
import Brand from "./Brand";
import Skills from "./Skills";
import { ExternalUrl } from "../components/Scope";
import Runs from "./Runs";
import Features from "./Features";
import Whitelabel, { Clients } from "./Whitelabel";
import { partner } from "../data/partner";
import { Autopilot, Schedules } from "./Autopilot";
import { isOn, settingsOwner, useFeatures } from "../lib/features";
import { featureOf } from "../data/features";
import { ConnectFlow, ProviderMark } from "../components/Outreach";
import { leadVariables, providers } from "../data/sequencers";
import { createStarterCampaign, disconnect, setRules, useOutreach } from "../lib/outreach";
import { timeAgo } from "../lib/runs";
import { ConnectToolModal, ToolMark } from "../components/Ads";
import { tools, type Tool, type ToolGroup } from "../data/ads";
import { disconnectTool, useAds } from "../lib/ads";
import { checkDns, disconnectEmail, disconnectPhone, setChannels, useCrm } from "../lib/crm";
import { DnsTable, EmailSetup, PhoneSetup, ProviderMark as SendMark, regLabel, regTone } from "../components/Sending";
import { emailProviders, phoneProviders } from "../data/providers";
import { assistant, product } from "../lib/whitelabel";

// Two scopes, one rule: Organization settings are shared by everyone who works on
// the Organization and travel with it (voice, skills, Locations, Websites,
// Accounts, who has access). "You" settings belong to the signed-in Member and
// follow them to every Organization they open (sign-in, theme, notifications, plan).
// Partner settings sit above both: one whitelabel for every Client, for its admins only.
type Section = { id: string; label: string; icon: typeof Store; page: () => React.JSX.Element };

export const businessSections: Section[] = [
  { id: "features", label: "Features", icon: ToggleRight, page: Features },
  { id: "brand", label: "Brand voice", icon: AudioLines, page: Brand },
  { id: "skills", label: `${assistant()} skills`, icon: Puzzle, page: Skills },
  { id: "locations", label: "Locations", icon: MapPin, page: Locations },
  { id: "websites", label: "Websites", icon: Globe, page: Websites },
  { id: "accounts", label: "Accounts", icon: AtSign, page: Accounts },
  { id: "ads", label: "Ad accounts", icon: Megaphone, page: AdAccounts },
  { id: "messaging", label: "Email & texting", icon: MessageSquareText, page: Messaging },
  { id: "integrations", label: "Integrations", icon: Plug, page: Integrations },
  { id: "autopilot", label: "Autopilot", icon: Zap, page: Autopilot },
  { id: "schedules", label: "Schedules", icon: CalendarClock, page: Schedules },
  { id: "team", label: "Team", icon: Users, page: Team },
  { id: "activity", label: "Activity", icon: History, page: Runs },
];
export const partnerSections: Section[] = partner?.role === "Admin" ? [
  { id: "whitelabel", label: "Whitelabel", icon: Paintbrush, page: Whitelabel },
  { id: "clients", label: "Clients", icon: Building2, page: Clients },
] : [];
export const accountSections: Section[] = [
  { id: "profile", label: "Profile", icon: UserRound, page: AccountProfile },
  { id: "appearance", label: "Appearance", icon: Palette, page: Appearance },
  { id: "notifications", label: "Notifications", icon: Bell, page: Notifications },
  // The sequencer is the agency's, so it follows the Member across Organizations.
  ...(member.plan === "agency" ? [{ id: "outreach", label: "Outreach", icon: Send, page: Outreach }] : []),
  { id: "billing", label: "Plan & billing", icon: CreditCard, page: Billing },
];

function SubNav() {
  const { orgId } = useScope();
  const current = memberships.find((m) => m.id === orgId) ?? organization;
  const ref = useRef<HTMLElement>(null);
  const { section } = useParams();
  const flags = useFeatures();
  // Sections that belong to a turned-off feature (Ad accounts, Email & texting, Outreach) are hidden.
  const visible = (items: Section[]) => items.filter((x) => { const o = settingsOwner(x.id); return !o || isOn(o, flags); });
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
      {group(current.name, `Organization settings, shared by everyone on ${current.name}`, visible(businessSections))}
      <span aria-hidden className="w-px shrink-0 self-stretch bg-line lg:hidden" />
      {partner && partnerSections.length > 0 && (
        <>
          <span aria-hidden className="w-px shrink-0 self-stretch bg-line lg:hidden" />
          {group(partner.name, "Partner settings, for every client", partnerSections)}
        </>
      )}
      <span aria-hidden className="w-px shrink-0 self-stretch bg-line lg:hidden" />
      {group("You", "Just for you, in every organization", visible(accountSections))}
    </nav>
  );
}

export default function Settings() {
  const { section } = useParams();
  const found = [...businessSections, ...partnerSections, ...accountSections].find((s) => s.id === section);
  useFeatures();
  // Settings → Automation became Autopilot.
  if (section === "automation") return <Navigate replace to="/settings/autopilot" />;
  if (!found) return <Navigate replace to="/settings/brand" />;
  const owner = settingsOwner(found.id);
  if (owner && !isOn(owner)) return <Navigate replace to={`/settings/features#${featureOf(owner).module ?? owner}`} />;
  const Page = found.page;
  return (
    <div className="grid gap-6 lg:grid-cols-[184px_minmax(0,1fr)] lg:gap-10">
      <SubNav />
      <div className="min-w-0"><Page /></div>
    </div>
  );
}

// ---------- Organization structure ----------

function Locations() {
  const st = useSetup();
  return (
    <>
      <PageHeader title="Locations" sub={`Places customers visit. Rankings, competitors and citations work from the address alone; connecting the Google profile adds reviews, calls and posting. Every location shares ${organization.name}'s brand voice.`} actions={<Button size="sm" icon={<Plus size={13} />}>Add location</Button>} />
      <Card pad={false} className="max-w-3xl">
        {locations.map((l) => {
          const site = websites.find((w) => w.locationIds.includes(l.id) && st.website[w.id]);
          const gp = st.googleProfile[l.id];
          const tagged = accounts.filter((a) => a.locationId === l.id && a.platform !== "google");
          return (
            <div key={l.id} className="flex flex-wrap items-start gap-4 border-b border-line px-5 py-4 last:border-0">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-hover"><MapPin size={16} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium">{shortLocation(l.id)}</div>
                <div className="text-[12.5px] text-muted">{l.address}</div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
                  <Badge tone={gp ? "good" : "warn"}><Store size={11} /> Google profile {gp ? "connected" : "not connected"}</Badge>
                  <Badge>{l.keywords} keywords</Badge>
                  {site && <Badge><Globe size={11} /> <ExternalUrl domain={site.domain} /></Badge>}
                  {tagged.map((a) => <Badge key={a.id}><PlatformMark platform={a.platform} size={12} /> {a.handle}</Badge>)}
                </div>
              </div>
              <Button size="sm" variant={gp ? "ghost" : "primary"} onClick={() => setGoogleProfile(l.id, !gp)}>{gp ? "Disconnect Google profile" : "Connect Google profile"}</Button>
            </div>
          );
        })}
      </Card>
    </>
  );
}

function Websites() {
  const st = useSetup();
  return (
    <>
      <PageHeader title="Websites" sub="Sites the organization owns. One website can serve several locations; site health, articles and search data are per website." actions={<Button size="sm" icon={<Plus size={13} />}>Add website</Button>} />
      <div className="max-w-3xl space-y-4">
        {websites.map((w) => (
          <Card key={w.id} pad={false} className={cn(!st.website[w.id] && "opacity-70")}>
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
              <span className="grid size-9 place-items-center rounded-lg bg-hover"><Globe size={16} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium"><ExternalUrl domain={w.domain} /></div>
                <div className="text-[12.5px] text-muted">Serves {w.locationIds.length === locations.length ? "every location" : w.locationIds.map(shortLocation).join(", ")}</div>
              </div>
              <Button size="sm" variant={st.website[w.id] ? "ghost" : "primary"} onClick={() => setWebsite(w.id, !st.website[w.id])}>{st.website[w.id] ? "Remove" : "Add website"}</Button>
            </div>
            {st.website[w.id] && w.tools.map((t) => (
              <div key={t.name} className="flex items-center gap-4 border-b border-line px-5 py-3.5 last:border-0">
                <span className="grid size-8 place-items-center rounded-lg bg-hover">{t.name === "Search Console" ? <SearchCheck size={15} /> : t.name === "WordPress" ? <Globe size={15} /> : <BarChart3 size={15} />}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13.5px] font-medium">{t.name}{t.connected && <Badge tone="good"><Check size={10} /> Connected</Badge>}</div>
                  <div className="truncate text-[12.5px] text-muted">{t.detail}</div>
                </div>
                <Button size="sm" variant={t.connected ? "ghost" : "primary"}>{t.connected ? "Manage" : "Connect"}</Button>
              </div>
            ))}
          </Card>
        ))}
      </div>
    </>
  );
}

/** The organization's own profiles to post from, grouped by platform. Each speaks for every location unless it's tagged to one. */
function Accounts() {
  const st = useSetup();
  const [list, setList] = useState(accounts);
  const [adding, setAdding] = useState(false);
  const social = (Object.keys(platformMeta) as SocialPlatform[]).filter((p) => p !== "google");
  const add = (p: SocialPlatform) => { setList([...list, { id: `${p}-${Date.now().toString(36)}`, platform: p, handle: `New ${platformMeta[p].name} account`, connected: false, followers: 0, followersPrev: 0 }]); setAdding(false); };
  return (
    <>
      <PageHeader title="Accounts" sub="Your profiles on each platform, the ones you post from. An account speaks for every location unless you tag it to one." actions={<Button size="sm" icon={<Plus size={13} />} onClick={() => setAdding(!adding)}>Add account</Button>} />
      {adding && (
        <div className="mb-4 flex max-w-3xl flex-wrap gap-1.5 rounded-lg bg-hover p-2.5">
          {social.map((p) => <button key={p} onClick={() => add(p)} className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-surface pr-3 pl-1.5 text-[13px] hover:border-line-strong"><PlatformMark platform={p} size={20} /> {platformMeta[p].name}</button>)}
        </div>
      )}
      <div className="max-w-3xl space-y-4">
        {social.filter((p) => list.some((a) => a.platform === p)).map((p) => (
          <Card key={p} pad={false}>
            <div className="border-b border-line px-5 py-2.5 text-[12.5px] font-medium text-muted">{platformMeta[p].name}</div>
            {list.filter((a) => a.platform === p).map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-3.5 last:border-0">
                <PlatformMark platform={a.platform} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[14px] font-medium">{a.handle}{accountConnected(a.id, st) && <Badge tone="good"><Check size={10} /> Connected</Badge>}</div>
                  <div className="text-[12.5px] text-muted">{accountConnected(a.id, st) ? `${a.followers.toLocaleString()} followers` : "Not connected yet"}</div>
                </div>
                {locations.length > 1 && (
                  <label className="flex items-center gap-2 text-[12.5px] text-muted">Speaks for
                    <select value={a.locationId ?? ""} onChange={(e) => setList(list.map((x) => (x.id === a.id ? { ...x, locationId: e.target.value || undefined } : x)))} className="h-8 rounded-md border border-line bg-surface px-2 text-[13px] text-fg outline-none">
                      <option value="">All locations</option>
                      {locations.map((l) => <option key={l.id} value={l.id}>{shortLocation(l.id)}</option>)}
                    </select>
                  </label>
                )}
                <Button size="sm" variant={accountConnected(a.id, st) ? "ghost" : "primary"} onClick={() => setAccount(a.id, !accountConnected(a.id, st))}>{accountConnected(a.id, st) ? "Disconnect" : "Connect"}</Button>
              </div>
            ))}
          </Card>
        ))}
        <p className="text-[12.5px] text-subtle">Google profiles belong to a location and are under <NavLink to="/settings/locations" className="underline decoration-line-strong underline-offset-2 hover:text-fg">Locations</NavLink>.</p>
      </div>
    </>
  );
}

function Messaging() {
  const st = useCrm();
  const { email, sms, call } = st.channels;
  const [setup, setSetup] = useState<"email" | "phone" | "numbers" | null>(null);
  const [checking, setChecking] = useState(false);
  const { toast, node } = useToast();
  const field = "h-9 w-full rounded-lg border border-line bg-surface px-3 text-[13.5px] outline-none focus:border-line-strong";
  const hours = Array.from({ length: 24 }, (_, h) => ({ h, label: new Date(2026, 0, 1, h).toLocaleTimeString("en-US", { hour: "numeric" }) }));
  const missing = email.records.filter((r) => !r.ok).length;
  const row = (label: string, control: React.ReactNode, hint?: string) => (
    <div key={label} className="grid gap-1.5 border-t border-line py-3 first:border-0 first:pt-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center sm:gap-4">
      <div><div className="text-[13px] font-medium">{label}</div>{hint && <div className="text-[12px] text-muted">{hint}</div>}</div>{control}
    </div>
  );
  const empty = (icon: React.ReactNode, title: string, sub: string, cta: string, onClick: () => void) => (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">{icon}</span>
      <div className="min-w-0 flex-1"><div className="text-[14px] font-medium">{title}</div><div className="text-[12.5px] text-muted">{sub}</div></div>
      <Button variant="primary" onClick={onClick}>{cta}</Button>
    </div>
  );
  const ep = email.provider ? emailProviders[email.provider] : null;
  const pp = sms.provider ? phoneProviders[sms.provider] : null;
  return (
    <>
      <PageHeader title="Email & texting" sub="Who sends your campaigns, workflows and Inbox replies. Shared by everyone on this organization." />
      <div className="max-w-3xl space-y-4">
        <Card>
          {!ep ? empty(<Mail size={18} />, "Set up email sending", `Use ${product()}'s sending, or connect Amazon SES, Resend, Mailgun, Postmark or SendGrid. About 5 minutes plus DNS.`, "Set up email", () => setSetup("email")) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <SendMark mark={ep.mark} color={ep.color} size={34} />
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-[14px] font-medium">Email · {ep.name}{email.verified ? <Badge tone="good"><Check size={10} />Verified</Badge> : <Badge tone="warn">Waiting for DNS</Badge>}</div><div className="truncate text-[12.5px] text-muted">Sending from {email.domain}{email.region ? ` · ${email.region}` : ""}</div></div>
                <Button size="sm" onClick={() => setSetup("email")}>{email.verified ? "Change" : "Finish setup"}</Button>
                <Button size="sm" variant="ghost" onClick={() => { disconnectEmail(); toast("Disconnected. Emails stop until you connect again"); }}>Disconnect</Button>
              </div>
              {missing > 0 && email.verified && <p className="mb-3 flex items-start gap-2 text-[12.5px] text-muted"><AlertTriangle size={13} className="mt-0.5 shrink-0 text-warn" /><span>{missing} record still missing. Gmail and Yahoo require DMARC from anyone sending in bulk. Add it, then <button onClick={() => { setChecking(true); checkDns((m) => { setChecking(false); toast(m ? `${m} still missing` : "All records found"); }); }} className="underline underline-offset-2">{checking ? "checking…" : "check again"}</button>.</span></p>}
              {(missing > 0 || !email.verified) && <div className="mb-4"><DnsTable records={email.records} /></div>}
              {row("From", <input value={`${email.fromName} <${email.fromAddress}>`} readOnly aria-label="From" className={field} />)}
              {row("Replies go to", <input value={email.replyTo} onChange={(e) => setChannels("email", { replyTo: e.target.value })} aria-label="Reply-to" className={field} />, "And show in the Inbox")}
              {row("Footer address", <input value={email.footer} onChange={(e) => setChannels("email", { footer: e.target.value })} aria-label="Footer address" className={field} />, "Required by CAN-SPAM, with an unsubscribe link")}
              <p className="mt-1 text-[12px] text-subtle">{ep.privacy}</p>
            </>
          )}
        </Card>

        <Card>
          {!pp ? empty(<MessageSquareText size={18} />, "Set up texting & calls", "Get a local number per location, or text-enable the one you have. We file the carrier registration with you.", "Set up texting", () => setSetup("phone")) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <SendMark mark={pp.mark} color={pp.color} size={34} />
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-[14px] font-medium">Texting & calls · {pp.name}{sms.campaign === "approved" ? <Badge tone="good"><Check size={10} />Texting live</Badge> : <Badge tone="info">Registration {regLabel(sms.campaign).toLowerCase()}</Badge>}</div><div className="text-[12.5px] text-muted">One number per location. Replies and missed calls come to the Inbox.</div></div>
                <Button size="sm" variant="ghost" onClick={() => { disconnectPhone(); toast("Disconnected. Texts stop until you connect again"); }}>Disconnect</Button>
              </div>
              {sms.numbers.map((n) => row(n.location, <div className="flex flex-wrap items-center gap-2 text-[13.5px]"><span className="num">{n.number}</span><Badge tone={n.status === "active" ? "good" : "info"}>{n.status === "active" ? "Live" : n.how === "port" ? "Moving here" : "Being text-enabled"}</Badge></div>))}
              {row("Numbers", <div><Button size="sm" onClick={() => setSetup("numbers")}>{sms.numbers.length ? "Change numbers" : "Add numbers"}</Button></div>)}
              {row("Carrier registration", <div className="flex flex-wrap items-center gap-2 text-[13px]">Business <Badge tone={regTone(sms.brand)}>{regLabel(sms.brand)}</Badge> Campaign <Badge tone={regTone(sms.campaign)}>{regLabel(sms.campaign)}</Badge>{sms.brand === "none" && sms.numbers.length > 0 && <Button size="sm" variant="primary" onClick={() => setSetup("numbers")}>Register</Button>}</div>, "A2P 10DLC, required by US carriers")}
              {row("Quiet hours", <div className="flex items-center gap-2 text-[13px]">Only between
                <select value={sms.quietStart} onChange={(e) => setChannels("sms", { quietStart: +e.target.value })} aria-label="From" className="h-8 rounded-md border border-line bg-surface px-2">{hours.map((x) => <option key={x.h} value={x.h}>{x.label}</option>)}</select>and
                <select value={sms.quietEnd} onChange={(e) => setChannels("sms", { quietEnd: +e.target.value })} aria-label="Until" className="h-8 rounded-md border border-line bg-surface px-2">{hours.map((x) => <option key={x.h} value={x.h}>{x.label}</option>)}</select></div>, "In their time zone. Later texts wait for morning")}
              {row("Opt-out line", <input value={sms.optOutLine} onChange={(e) => setChannels("sms", { optOutLine: e.target.value })} aria-label="Opt-out line" className={field} />, "Added to the first text anyone gets. STOP, END and UNSUBSCRIBE are honored on their own")}
            </>
          )}
        </Card>

        {pp && (
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><Phone size={15} />Calls</span>} sub="Calls to your location numbers ring the front desk and show in each contact's timeline." />
            {row("Rings", <span className="text-[13.5px]">{call.forwardTo}</span>)}
            {row("Voicemail to text", <Toggle label="Voicemail to text" checked={call.voicemailToText} onChange={(v) => setChannels("call", { voicemailToText: v })} />, "Voicemails are written out in the Inbox")}
            {row("Record calls", <Toggle label="Record calls" checked={call.recordCalls} onChange={(v) => setChannels("call", { recordCalls: v })} />, "Callers hear “this call may be recorded” first")}
            {row("Missed calls", <NavLink to="/workflows" className="text-[13px] underline underline-offset-2">{st.workflows.some((a) => a.when.event === "missed_call" && a.on) ? "Texted back by the Missed call text-back workflow" : "Turn on Missed call text-back in Workflows"}</NavLink>)}
            <p className="mt-1 text-[12px] text-subtle">{product()} never dials automatically. Call steps in workflows make a task with a script for the front desk.</p>
          </Card>
        )}

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><ShieldCheck size={15} />Patient privacy</span>} sub="Messages to patients count as health information under HIPAA." />
          <ul className="space-y-1.5 text-[13px]">
            <li className="flex items-start gap-2"><Check size={14} className="mt-0.5 shrink-0 text-good" />Use providers that have signed a Business Associate Agreement with you. Each provider above says where it stands.</li>
            <li className="flex items-start gap-2"><Check size={14} className="mt-0.5 shrink-0 text-good" />Messages that name a treatment get a warning before they're sent. Texts show on lock screens.</li>
            <li className="flex items-start gap-2"><Check size={14} className="mt-0.5 shrink-0 text-good" />Who agreed to texts and email, and how, is kept on each contact.</li>
          </ul>
        </Card>
      </div>
      {setup === "email" && <EmailSetup open onClose={() => setSetup(null)} toast={toast} />}
      {(setup === "phone" || setup === "numbers") && <PhoneSetup open onClose={() => setSetup(null)} toast={toast} startAt={setup === "numbers" ? "numbers" : undefined} />}
      {node}
    </>
  );
}

function Integrations() {
  return (
    <>
      <PageHeader title="Integrations" sub="Tools connected to the organization. Website tools (Search Console, Analytics, WordPress) are under Websites." />
      <Card pad={false} className="max-w-3xl">
        <div className="flex items-center gap-4 px-5 py-4">
          <span className="grid size-9 place-items-center rounded-lg bg-hover"><Hash size={16} /></span>
          <div className="min-w-0 flex-1"><div className="text-[14px] font-medium">Slack</div><div className="truncate text-[12.5px] text-muted">Alerts and weekly digests</div></div>
          <Button size="sm" variant="primary">Connect</Button>
        </div>
      </Card>
    </>
  );
}

const toolGroups: { id: ToolGroup; hint: string }[] = [
  { id: "Ad accounts", hint: `Where ads run. ${assistant()} reads results here and publishes what you approve.` },
  { id: "Counting results", hint: "Without these, platforms optimize for clicks. With them, for booked patients." },
  { id: "Making creatives", hint: "Renders every size from one design and turns scripts into video." },
  { id: "Research", hint: "Ad libraries are built in. Bring in boards you've saved elsewhere." },
];

function AdAccounts() {
  const st = useAds();
  const [connect, setConnect] = useState<Tool | null>(null);
  return (
    <>
      <PageHeader title="Ad accounts" sub="Where ads run, how results are counted, and the tools that make creatives. Shared by everyone on this organization." />
      <div className="max-w-3xl space-y-4">
        {toolGroups.map((g) => (
          <Card key={g.id} pad={false}>
            <div className="border-b border-line px-5 py-3"><div className="text-[14px] font-medium">{g.id}</div><div className="text-[12.5px] text-muted">{g.hint}</div></div>
            {tools.filter((t) => t.group === g.id).map((t) => {
              const on = st.connected[t.id];
              const blocked = t.needs && !st.connected[t.needs];
              return (
                <div key={t.id} className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-3.5 last:border-0">
                  <ToolMark tool={t} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[14px] font-medium">{t.name}{on && <Badge tone="good"><Check size={10} /> Connected</Badge>}</div>
                    <div className="text-[12.5px] text-muted">{on ? `${t.account} · connected ${timeAgo(on)}` : blocked ? `Connect ${tools.find((x) => x.id === t.needs)?.name} first` : t.what}</div>
                  </div>
                  {on ? <Button size="sm" variant="danger" onClick={() => disconnectTool(t.id)}>Disconnect</Button> : <Button size="sm" variant="primary" disabled={!!blocked} onClick={() => setConnect(t)}>Connect</Button>}
                </div>
              );
            })}
          </Card>
        ))}
      </div>
      <ConnectToolModal tool={connect} onClose={() => setConnect(null)} />
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
      <PageHeader title="Notifications" sub={`What ${product()} emails you about, for every business you're on.`} />
      <Card className="max-w-3xl">
        {([
          ["digest", "Weekly digest", `Rankings, reviews and what ${assistant()} did, every Monday`],
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

function Outreach() {
  const st = useOutreach();
  const [copied, setCopied] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const c = st.connection;
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); setCopied(t); setTimeout(() => setCopied(null), 1500); } catch {} };
  if (!c || connecting) return (
    <>
      <PageHeader title="Outreach" sub="Connect the sequencer you send cold email from. Prospects go to it with their audit link in one click, and replies come back to Outreach." />
      <Card className="max-w-xl"><ConnectFlow onConnect={() => setConnecting(true)} onDone={() => setConnecting(false)} /></Card>
    </>
  );
  const name = providers[c.provider].name;
  const row = "flex flex-wrap items-center gap-4 border-b border-line px-5 py-3.5 last:border-0";
  return (
    <>
      <PageHeader title="Outreach" sub={`${name} sends, warms up and rotates your inboxes. ${product()} hands it prospects and reads back replies, labels and bounces.`} />
      <div className="max-w-3xl space-y-4">
        <Card pad={false}>
          <div className={row}>
            <ProviderMark id={c.provider} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[14px] font-medium">{name} · {c.workspace}<Badge tone="good"><Check size={10} /> Connected</Badge></div>
              <div className="text-[12.5px] text-muted">API key ••••{c.keyLast4} · connected {timeAgo(c.connectedAt)}</div>
            </div>
            <Button size="sm" variant="danger" onClick={disconnect}>Disconnect</Button>
          </div>
          <div className="flex items-start gap-3 px-5 py-3 text-[12.5px] text-muted"><Webhook size={14} className="mt-0.5 shrink-0" /><span>Listening for replies, label changes, bounces and unibox sends. Disconnecting stops updates here; anything already sent keeps going in {name}.</span></div>
        </Card>

        <Card pad={false}>
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
            <div><div className="text-[14px] font-medium">Campaigns</div><div className="text-[12.5px] text-muted">The default is where one-click sends go.</div></div>
            {!c.campaigns.some((x) => x.fromOpenMarko) && <Button size="sm" icon={<Plus size={13} />} onClick={() => { const n = createStarterCampaign(); if (n) setRules({ defaultCampaign: n.id }); }}>Create audit campaign</Button>}
          </div>
          {c.campaigns.map((x) => (
            <div key={x.id} className={row}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium">{x.name}{st.rules.defaultCampaign === x.id && <Badge tone="accent">Default</Badge>}{x.fromOpenMarko && <Badge>Made by {product()}</Badge>}</div>
                <div className="text-[12.5px] text-muted">{x.steps.length} steps over {x.steps[x.steps.length - 1].day} days · {x.leads} leads · {x.replyRate}% reply rate · {x.status}</div>
                {!x.usesAuditUrl && <div className="mt-1 flex items-center gap-1.5 text-[12px] text-warn"><AlertTriangle size={12} />Doesn't use {"{{audit_url}}"}. Add it to the first email in {name}.</div>}
              </div>
              {st.rules.defaultCampaign !== x.id && <Button size="sm" variant="ghost" onClick={() => setRules({ defaultCampaign: x.id })}>Make default</Button>}
            </div>
          ))}
        </Card>

        <Card pad={false}>
          <div className="border-b border-line px-5 py-3"><div className="text-[14px] font-medium">Sending inboxes</div><div className="text-[12.5px] text-muted">Read from {name}. Add inboxes and change warmup there.</div></div>
          {c.inboxes.map((i) => (
            <div key={i.email} className={row}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px]">{i.email}</div>
                <div className="mt-1.5 flex items-center gap-2"><Progress value={i.warmup} tone={i.warmup >= 90 ? "good" : "warn"} className="w-24" /><span className="num text-[12px] text-muted">Warmup {i.warmup}%</span></div>
              </div>
              <span className="num text-[12.5px] text-muted">{i.dailyLimit ? `${i.sentToday} / ${i.dailyLimit} today` : "Not sending"}</span>
              <Badge tone={i.status === "ready" ? "good" : i.status === "warming" ? "warn" : "neutral"} className="capitalize">{i.status}</Badge>
            </div>
          ))}
        </Card>

        <Card>
          <CardHeader title="Sending" />
          {([
            ["review", "Review before sending", "Off: Send to campaign on a prospect or audit sends straight to the default campaign."],
            ["verifiedOnly", "Only verified emails", "Skips catch-all and unverified addresses to protect your inboxes' reputation."],
            ["alertOnAudit", "Tell me when a prospect opens their audit twice", "Usually the best moment to call."],
          ] as const).map(([k, l, d]) => (
            <div key={k} className="flex items-center gap-4 border-t border-line py-3.5 first:border-0 first:pt-0">
              <div className="flex-1"><div className="text-[14px]">{l}</div><div className="text-[12.5px] text-muted">{d}</div></div>
              <Toggle label={l} checked={st.rules[k]} onChange={(v) => setRules({ [k]: v })} />
            </div>
          ))}
          <label className="block border-t border-line pt-3.5">
            <span className="block text-[14px]">Booking link</span>
            <span className="mb-1.5 block text-[12.5px] text-muted">Used in drafted replies.</span>
            <input value={st.rules.bookingUrl} onChange={(e) => setRules({ bookingUrl: e.target.value })} className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-[13.5px] outline-none focus:border-line-strong" />
          </label>
        </Card>

        <Card pad={false}>
          <div className="border-b border-line px-5 py-3"><div className="text-[14px] font-medium">Variables sent with each prospect</div><div className="text-[12.5px] text-muted">Use these in your {name} templates.</div></div>
          {leadVariables.map((v) => (
            <div key={v.key} className="flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-0">
              <code className="w-36 shrink-0 font-mono text-[12.5px]">{`{{${v.key}}}`}</code>
              <span className="min-w-0 flex-1 truncate text-[13px]">{v.label} <span className="text-subtle">· {v.example}</span></span>
              <button onClick={() => copy(`{{${v.key}}}`)} aria-label={`Copy {{${v.key}}}`} className="rounded p-1 text-muted hover:bg-hover hover:text-fg">{copied === `{{${v.key}}}` ? <Check size={13} /> : <Copy size={13} />}</button>
            </div>
          ))}
        </Card>
      </div>
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

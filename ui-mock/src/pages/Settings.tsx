import { useEffect, useRef, useState } from "react";
import { Navigate, NavLink, useParams } from "react-router";
import {
  Store, Globe, Check, AudioLines, Puzzle, MapPin, Plug, Zap, Users, History,
  UserRound, Palette, Bell, Building2, Paintbrush, CreditCard, Sun, Moon, Monitor, Plus, Send, Copy, Webhook, AlertTriangle, ToggleRight, CalendarClock, MessageSquareText, Pencil, Phone, ShieldCheck, Trash2,
} from "lucide-react";
import { Badge, Button, Card, CardHeader, Checkbox, Field, FieldLabel, Input, Modal, PageHeader, Progress, Select, Toggle, cn, useToast } from "../components/ui";
import { locations, member, type Location } from "../data/mock";
import { accounts } from "../data/social";
import { PlatformMark } from "../components/Social";
import { memberships, organization, shortLocation, websites, type Website } from "../data/org";
import { setScope, useScope } from "../lib/scope";
import { addLocation, addWebsite, removeLocation, setWebsite, updateLocation, updateWebsite, useSetup } from "../lib/setup";
import { setThemeMode, useThemeMode, type ThemeMode } from "../lib/theme";
import Brand from "./Brand";
import Skills from "./Skills";
import { ExternalUrl } from "../components/Scope";
import { CapabilityCard, ConnectionsAt } from "../components/Integrations";
import Integrations from "./Integrations";
import { locationTarget, websiteTarget } from "../lib/integrations";
import { ViewOnly } from "../components/ViewOnly";
import Runs from "./Runs";
import Features from "./Features";
import Whitelabel, { Clients } from "./Whitelabel";
import Team, { PartnerTeam } from "./Team";
import { can, previewing, useAccess } from "../lib/access";
import type { Resource } from "../data/access";
import { partner } from "../data/partner";
import { Autopilot, Schedules } from "./Autopilot";
import { isOn, settingsOwner, useFeatures } from "../lib/features";
import { featureOf } from "../data/features";
import { leadVariables, providers } from "../data/sequencers";
import { createStarterCampaign, setRules, useOutreach } from "../lib/outreach";
import { checkDns, setChannels, useCrm } from "../lib/crm";
import { DnsTable, PhoneSetup, regLabel, regTone } from "../components/Sending";
import { emailProviders, phoneProviders } from "../data/providers";
import { assistant, product } from "../lib/whitelabel";

// Two scopes, one rule: Organization settings are shared by everyone who works on
// the Organization and travel with it (voice, skills, Locations, Websites,
// Accounts, the outreach sequencer, who has access). "You" settings belong to the signed-in Member and
// follow them to every Organization they open (sign-in, theme, notifications, plan).
// Partner settings sit above both: one whitelabel for every Client, for its admins only.
// `needs` hides a section from roles that can't see it; `edits` is the action that
// changes it, and without it the section opens view only.
type Perm = [Resource, string];
type Section = { id: string; label: string; icon: typeof Store; page: () => React.JSX.Element; needs?: Perm; edits?: Perm };

export const businessSections: Section[] = [
  { id: "features", label: "Features", icon: ToggleRight, page: Features, needs: ["organization", "update"] },
  { id: "brand", label: "Brand voice", icon: AudioLines, page: Brand, needs: ["brand", "view"], edits: ["brand", "edit"] },
  { id: "skills", label: `${assistant()} skills`, icon: Puzzle, page: Skills, needs: ["brand", "view"], edits: ["brand", "edit"] },
  { id: "locations", label: "Locations", icon: MapPin, page: Locations, needs: ["setup", "view"], edits: ["setup", "connect"] },
  { id: "websites", label: "Websites", icon: Globe, page: Websites, needs: ["setup", "view"], edits: ["setup", "connect"] },
  { id: "messaging", label: "Email & texting", icon: MessageSquareText, page: Messaging, needs: ["email", "view"], edits: ["email", "connect"] },
  ...(member.plan === "agency" ? [{ id: "outreach", label: "Outreach", icon: Send, page: Outreach, needs: ["outreach", "view"], edits: ["outreach", "connect"] } satisfies Section] : []),
  // Connections are gated one by one, by what each powers (data/integrations.ts).
  { id: "integrations", label: "Integrations", icon: Plug, page: Integrations },
  { id: "autopilot", label: "Autopilot", icon: Zap, page: Autopilot, needs: ["autopilot", "view"], edits: ["autopilot", "edit"] },
  { id: "schedules", label: "Schedules", icon: CalendarClock, page: Schedules, needs: ["autopilot", "view"], edits: ["autopilot", "edit"] },
  { id: "team", label: "Team", icon: Users, page: Team },
  { id: "activity", label: "Activity", icon: History, page: Runs, needs: ["activity", "view"] },
];
export const partnerSections: Section[] = partner?.role === "Admin" ? [
  { id: "whitelabel", label: "Whitelabel", icon: Paintbrush, page: Whitelabel },
  { id: "clients", label: "Clients", icon: Building2, page: Clients },
  { id: "partner-team", label: "Partner team", icon: Users, page: PartnerTeam },
] : [];
export const accountSections: Section[] = [
  { id: "profile", label: "Profile", icon: UserRound, page: AccountProfile },
  { id: "appearance", label: "Appearance", icon: Palette, page: Appearance },
  { id: "notifications", label: "Notifications", icon: Bell, page: Notifications },
  { id: "billing", label: "Plan & billing", icon: CreditCard, page: Billing },
];

const allowed = (x: Section) => (!partnerSections.includes(x) || !previewing()) && (!x.needs || can(...x.needs));
/** For links to a section from elsewhere (the command palette). */
export const sectionAllowed = (id: string) => { const x = [...businessSections, ...partnerSections, ...accountSections].find((s) => s.id === id); return !x || allowed(x); };

function SubNav() {
  const { orgId } = useScope();
  const current = memberships.find((m) => m.id === orgId) ?? organization;
  const ref = useRef<HTMLElement>(null);
  const { section } = useParams();
  const flags = useFeatures();
  useAccess();
  // Sections that belong to a turned-off feature (Ad accounts, Email & texting, Outreach), or that the role can't see, are hidden.
  const visible = (items: Section[]) => items.filter((x) => { const o = settingsOwner(x.id); return (!o || isOn(o, flags)) && allowed(x); });
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
      {partner && partnerSections.some(allowed) && (
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
  useAccess();
  // Settings → Automation became Autopilot; Ad accounts and Accounts became Integrations.
  if (section === "automation") return <Navigate replace to="/settings/autopilot" />;
  if (section === "ads") return <Navigate replace to="/settings/integrations?cat=Ads" />;
  if (section === "accounts") return <Navigate replace to="/settings/integrations?cat=Social" />;
  // Unknown, or not for this role: the first section the role can open (Team is open to everyone).
  if (!found || !allowed(found)) return <Navigate replace to={`/settings/${businessSections.find(allowed)!.id}`} />;
  const owner = settingsOwner(found.id);
  if (owner && !isOn(owner)) return <Navigate replace to={`/settings/features#${featureOf(owner).module ?? owner}`} />;
  const Page = found.page;
  return (
    <div className="grid gap-6 lg:grid-cols-[184px_minmax(0,1fr)] lg:gap-10">
      <SubNav />
      <div className="min-w-0">
        {found.edits && !can(...found.edits) && <ViewOnly />}
        {/* Settings pages are forms, so view only disables the whole page at once. */}
        <fieldset disabled={!!found.edits && !can(...found.edits)} className="contents"><Page /></fieldset>
      </div>
    </div>
  );
}

// ---------- Organization structure ----------

function Locations() {
  const st = useSetup();
  // "new" for Add location, or the Location being edited.
  const [editing, setEditing] = useState<Location | "new" | null>(null);
  const [deleting, setDeleting] = useState<Location | null>(null);
  const { toast, node } = useToast();
  const { locationId } = useScope();
  const only = locations.length < 2;
  const del = (l: Location) => {
    const name = shortLocation(l.id);
    removeLocation(l.id);
    if (locationId === l.id) setScope({ locationId: null });
    setDeleting(null);
    toast(`${name} deleted`);
  };
  return (
    <>
      <PageHeader title="Locations" sub={`Places customers visit. Rankings, competitors and citations work from the address alone; connecting the Google profile adds reviews, calls and posting. Every location shares ${organization.name}'s brand voice.`} actions={<Button size="sm" icon={<Plus size={13} />} onClick={() => setEditing("new")}>Add location</Button>} />
      {editing && <LocationForm location={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={(msg) => { setEditing(null); toast(msg); }} />}
      {deleting && <DeleteLocation location={deleting} onClose={() => setDeleting(null)} onDelete={() => del(deleting)} />}
      {node}
      <Card pad={false} className="max-w-3xl">
        {locations.map((l) => {
          const site = websites.find((w) => w.locationIds.includes(l.id) && st.website[w.id]);
          const tagged = accounts.filter((a) => a.locationId === l.id && a.platform !== "google");
          return (
            <div key={l.id} className="flex flex-wrap items-start gap-4 border-b border-line px-5 py-4 last:border-0">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-hover"><MapPin size={16} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium">{shortLocation(l.id)}</div>
                <div className="text-[12.5px] text-muted">{l.address}</div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
                  <Badge>{l.keywords} keywords</Badge>
                  {site && <Badge><Globe size={11} /> <ExternalUrl domain={site.domain} /></Badge>}
                  {tagged.map((a) => <Badge key={a.id}><PlatformMark platform={a.platform} size={12} /> {a.handle}</Badge>)}
                </div>
                <div className="mt-2.5"><ConnectionsAt target={locationTarget(l.id)} /></div>
              </div>
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" icon={<Pencil size={12} />} onClick={() => setEditing(l)}>Edit</Button>
                <Button size="sm" variant="ghost" icon={<Trash2 size={12} />} disabled={only} title={only ? "An organization needs at least one location" : undefined} onClick={() => setDeleting(l)} className="hover:text-bad">Delete</Button>
              </span>
            </div>
          );
        })}
      </Card>
    </>
  );
}

function Websites() {
  const st = useSetup();
  // "new" for Add website, or the Website being edited.
  const [editing, setEditing] = useState<Website | "new" | null>(null);
  const { toast, node } = useToast();
  return (
    <>
      <PageHeader title="Websites" sub="Sites the organization owns. One website can serve several locations; site health, articles and search data are per website." actions={<Button size="sm" icon={<Plus size={13} />} onClick={() => setEditing("new")}>Add website</Button>} />
      {editing && <WebsiteForm website={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={(msg) => { setEditing(null); toast(msg); }} />}
      {node}
      <div className="max-w-3xl space-y-4">
        {websites.map((w) => (
          <Card key={w.id} pad={false} className={cn(!st.website[w.id] && "opacity-70")}>
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
              <span className="grid size-9 place-items-center rounded-lg bg-hover"><Globe size={16} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium"><ExternalUrl domain={w.domain} /></div>
                <div className="text-[12.5px] text-muted">{!w.locationIds.length ? "Serves no location yet" : `Serves ${w.locationIds.length === locations.length ? "every location" : w.locationIds.map(shortLocation).join(", ")}`}</div>
              </div>
              {st.website[w.id] && <Button size="sm" variant="ghost" icon={<Pencil size={12} />} onClick={() => setEditing(w)}>Edit</Button>}
              <Button size="sm" variant={st.website[w.id] ? "ghost" : "primary"} onClick={() => setWebsite(w.id, !st.website[w.id])}>{st.website[w.id] ? "Remove" : "Add website"}</Button>
            </div>
            {st.website[w.id] && <div className="px-5 py-3.5"><ConnectionsAt target={websiteTarget(w.id)} /></div>}
          </Card>
        ))}
      </div>
    </>
  );
}

/** Strips a pasted URL down to its domain: "https://www.example.com/about" → "example.com". */
const toDomain = (v: string) => v.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
const isDomain = (d: string) => /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(d);

/** Says what goes with a Location before deleting it. */
function DeleteLocation({ location, onClose, onDelete }: { location: Location; onClose: () => void; onDelete: () => void }) {
  const name = shortLocation(location.id);
  const google = accounts.some((a) => a.platform === "google" && a.locationId === location.id);
  const tagged = accounts.filter((a) => a.platform !== "google" && a.locationId === location.id);
  const sites = websites.filter((w) => w.locationIds.includes(location.id));
  return (
    <Modal open onClose={onClose} title={`Delete ${name}?`} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="danger" icon={<Trash2 size={13} />} onClick={onDelete}>Delete location</Button></>}>
      <p className="mt-0 text-[13.5px] text-muted">{location.address}</p>
      <ul className="mb-0 space-y-1.5 pl-4 text-[13.5px]">
        <li>Its {location.keywords ? `${location.keywords} tracked keywords, ` : ""}rank history, map scans, competitors and citations are deleted.</li>
        {google && <li>Its Google profile is disconnected. The profile itself stays on Google.</li>}
        {sites.length > 0 && <li>{sites.map((w) => w.domain).join(" and ")} will stop serving it.</li>}
        {tagged.length > 0 && <li>{tagged.map((a) => a.handle).join(", ")} will speak for the whole organization instead.</li>}
      </ul>
      <p className="mb-0 text-[12.5px] text-subtle">This can't be undone.</p>
    </Modal>
  );
}

/** Adds a Location (location null) or edits one. */
function LocationForm({ location, onClose, onSaved }: { location: Location | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const [label, setLabel] = useState(location ? shortLocation(location.id) : "");
  const [address, setAddress] = useState(location?.address ?? "");
  const [site, setSite] = useState(location ? websites.find((w) => w.locationIds.includes(location.id))?.id ?? "" : "");
  const name = label.trim();
  const taken = locations.some((l) => l.id !== location?.id && shortLocation(l.id).toLowerCase() === name.toLowerCase());
  const ok = !!name && address.trim().length > 5 && !taken;
  const save = () => {
    if (!ok) return;
    if (location) { updateLocation(location.id, name, address.trim(), site || null); onSaved(`${name} saved`); }
    else { addLocation(name, address.trim(), site || null); onSaved(`${name} added. Connect its Google profile below.`); }
  };
  return (
    <Modal open onClose={onClose} title={location ? `Edit ${shortLocation(location.id)}` : "Add a location"} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!ok} onClick={save}>{location ? "Save" : "Add location"}</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4">
        <Field label="Name" hint={taken ? "There's already a location with this name." : `Shown as “${organization.name} — ${name || "Downtown"}”`}>
          <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Downtown" />
        </Field>
        <Field label="Address" hint={location ? "Changing it moves where rankings and map scans are measured from." : "Rankings, competitors and citations start from this."}>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, state ZIP" />
        </Field>
        <Field label="Website">
          <Select value={site} onChange={(e) => setSite(e.target.value)}>
            <option value="">None yet</option>
            {websites.map((w) => <option key={w.id} value={w.id}>{w.domain}</option>)}
          </Select>
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/** Adds a Website (website null) or edits one. */
function WebsiteForm({ website, onClose, onSaved }: { website: Website | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const [url, setUrl] = useState(website?.domain ?? "");
  const [serves, setServes] = useState<string[]>(website ? website.locationIds : locations.length === 1 ? [locations[0].id] : []);
  const domain = toDomain(url);
  const taken = websites.some((w) => w.id !== website?.id && w.domain === domain);
  const ok = isDomain(domain) && !taken && serves.length > 0;
  const save = () => {
    if (!ok) return;
    if (website) { updateWebsite(website.id, domain, serves); onSaved(`${domain} saved`); }
    else { addWebsite(domain, serves); onSaved(`${domain} added. Connect Search Console below.`); }
  };
  const hint = !url.trim() ? "Paste the address or type the domain." : taken ? "This website is already added." : !isDomain(domain) ? "That doesn't look like a website address." : website && domain !== website.domain ? "Reconnect Search Console and Analytics for the new address." : undefined;
  return (
    <Modal open onClose={onClose} title={website ? `Edit ${website.domain}` : "Add a website"} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!ok} onClick={save}>{website ? "Save" : "Add website"}</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4">
        <Field label="Website" hint={hint}>
          <Input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="yourbusiness.com" inputMode="url" />
        </Field>
        <div>
          <FieldLabel>Serves</FieldLabel>
          <div className="space-y-2">
            {locations.map((l) => (
              <label key={l.id} className="flex cursor-pointer items-center gap-2 text-[13.5px]">
                <Checkbox checked={serves.includes(l.id)} onChange={(v) => setServes(v ? [...serves, l.id] : serves.filter((x) => x !== l.id))} />
                {shortLocation(l.id) || l.name}<span className="text-[12.5px] text-muted">{l.address}</span>
              </label>
            ))}
          </div>
          {serves.length === 0 && <p className="mt-1 mb-0 text-[12px] text-subtle">Pick at least one location.</p>}
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function Messaging() {
  const st = useCrm();
  const { email, sms, call } = st.channels;
  const [setup, setSetup] = useState<"email" | "phone" | "numbers" | null>(null);
  const [checking, setChecking] = useState(false);
  const { toast, node } = useToast();
  const hours = Array.from({ length: 24 }, (_, h) => ({ h, label: new Date(2026, 0, 1, h).toLocaleTimeString("en-US", { hour: "numeric" }) }));
  const missing = email.records.filter((r) => !r.ok).length;
  const row = (label: string, control: React.ReactNode, hint?: string) => (
    <div key={label} className="grid gap-1.5 border-t border-line py-3 first:border-0 first:pt-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center sm:gap-4">
      <div><div className="text-[13px] font-medium">{label}</div>{hint && <div className="text-[12px] text-muted">{hint}</div>}</div>{control}
    </div>
  );
  const ep = email.provider ? emailProviders[email.provider] : null;
  const pp = sms.provider ? phoneProviders[sms.provider] : null;
  return (
    <>
      <PageHeader title="Email & texting" sub="Who sends your campaigns, workflows and Inbox replies, and how. The connections themselves are also under Integrations." />
      <div className="max-w-3xl space-y-4">
        <Card>
          <CapabilityCard cap="email.send" title="Email" />
          {ep && (
            <div className="mt-4">
              {missing > 0 && email.verified && <p className="mb-3 flex items-start gap-2 text-[12.5px] text-muted"><AlertTriangle size={13} className="mt-0.5 shrink-0 text-warn" /><span>{missing} record still missing. Gmail and Yahoo require DMARC from anyone sending in bulk. Add it, then <button onClick={() => { setChecking(true); checkDns((m) => { setChecking(false); toast(m ? `${m} still missing` : "All records found"); }); }} className="underline underline-offset-2">{checking ? "checking…" : "check again"}</button>.</span></p>}
              {(missing > 0 || !email.verified) && <div className="mb-4"><DnsTable records={email.records} /></div>}
              {row("From", <Input value={`${email.fromName} <${email.fromAddress}>`} readOnly aria-label="From" />)}
              {row("Replies go to", <Input value={email.replyTo} onChange={(e) => setChannels("email", { replyTo: e.target.value })} aria-label="Reply-to" />, "And show in the Inbox")}
              {row("Footer address", <Input value={email.footer} onChange={(e) => setChannels("email", { footer: e.target.value })} aria-label="Footer address" />, "Required by CAN-SPAM, with an unsubscribe link")}
              <p className="mt-1 text-[12px] text-subtle">{ep.privacy}</p>
            </div>
          )}
        </Card>

        <Card>
          <CapabilityCard cap="sms.send" title="Texting & calls" />
          {pp && (
            <div className="mt-4">
              {sms.numbers.map((n) => row(n.location, <div className="flex flex-wrap items-center gap-2 text-[13.5px]"><span className="num">{n.number}</span><Badge tone={n.status === "active" ? "good" : "info"}>{n.status === "active" ? "Live" : n.how === "port" ? "Moving here" : "Being text-enabled"}</Badge></div>))}
              {row("Numbers", <div><Button size="sm" onClick={() => setSetup("numbers")}>{sms.numbers.length ? "Change numbers" : "Add numbers"}</Button></div>)}
              {row("Carrier registration", <div className="flex flex-wrap items-center gap-2 text-[13px]">Business <Badge tone={regTone(sms.brand)}>{regLabel(sms.brand)}</Badge> Campaign <Badge tone={regTone(sms.campaign)}>{regLabel(sms.campaign)}</Badge>{sms.brand === "none" && sms.numbers.length > 0 && <Button size="sm" variant="primary" onClick={() => setSetup("numbers")}>Register</Button>}</div>, "A2P 10DLC, required by US carriers")}
              {row("Quiet hours", <div className="flex items-center gap-2 text-[13px]">Only between
                <Select size="sm" className="w-auto" value={sms.quietStart} onChange={(e) => setChannels("sms", { quietStart: +e.target.value })} aria-label="From">{hours.map((x) => <option key={x.h} value={x.h}>{x.label}</option>)}</Select>and
                <Select size="sm" className="w-auto" value={sms.quietEnd} onChange={(e) => setChannels("sms", { quietEnd: +e.target.value })} aria-label="Until">{hours.map((x) => <option key={x.h} value={x.h}>{x.label}</option>)}</Select></div>, "In their time zone. Later texts wait for morning")}
              {row("Opt-out line", <Input value={sms.optOutLine} onChange={(e) => setChannels("sms", { optOutLine: e.target.value })} aria-label="Opt-out line" />, "Added to the first text anyone gets. STOP, END and UNSUBSCRIBE are honored on their own")}
            </div>
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
      {(setup === "phone" || setup === "numbers") && <PhoneSetup open onClose={() => setSetup(null)} toast={toast} startAt={setup === "numbers" ? "numbers" : undefined} />}
      {node}
    </>
  );
}

function AccountProfile() {
  return (
    <>
      <PageHeader title="Profile" sub="How you sign in and how teammates see you." />
      <Card className="max-w-3xl">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-hover text-[15px] font-medium">AP</span>
          <Button size="sm" variant="ghost">Change photo</Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><Input size="lg" defaultValue="Dr. Anika Patel" /></Field>
          <Field label="Email"><Input size="lg" defaultValue="anika@mapleandmaindental.com" /></Field>
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
  const c = st.connection;
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); setCopied(t); setTimeout(() => setCopied(null), 1500); } catch {} };
  if (!c) return (
    <>
      <PageHeader title="Outreach" sub="Connect the sequencer you send cold email from. Prospects go to it with their audit link in one click, and replies come back to Outreach." />
      <Card className="max-w-3xl"><CapabilityCard cap="leads.push" title="Sequencer" /></Card>
    </>
  );
  const name = providers[c.provider].name;
  const row = "flex flex-wrap items-center gap-4 border-b border-line px-5 py-3.5 last:border-0";
  return (
    <>
      <PageHeader title="Outreach" sub={`${name} sends, warms up and rotates your inboxes. ${product()} hands it prospects and reads back replies, labels and bounces.`} />
      <div className="max-w-3xl space-y-4">
        <Card pad={false}>
          <div className="px-5 py-4"><CapabilityCard cap="leads.push" title="Sequencer" /></div>
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
            <Input size="lg" value={st.rules.bookingUrl} onChange={(e) => setRules({ bookingUrl: e.target.value })} />
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

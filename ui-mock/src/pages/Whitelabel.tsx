import { useState } from "react";
import { Check, Copy, Globe, ImageUp, Mail, Sparkles, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, Modal, PageHeader, Toggle, useToast } from "../components/ui";
import { Logo, LogoMark } from "../components/Logo";
import { DnsTable } from "../components/Sending";
import { dnsRecords } from "../data/providers";
import { fallbackHost, partner } from "../data/partner";
import { memberships } from "../data/org";
import { setScope, useScope } from "../lib/scope";
import { assistant, DEFAULT_ASSISTANT, setWhitelabel, useWhitelabel } from "../lib/whitelabel";

// One focus colour: the accent border and a soft accent ring, in place of the global :focus-visible outline.
const focus = "outline-none! transition-shadow focus:border-accent focus:ring-3 focus:ring-accent-soft";
const field = `h-9 w-full rounded-lg border border-line bg-surface px-3 text-[13.5px] ${focus}`;
// Logos live in localStorage in the mock, so keep them small. Real build: uploaded to storage, served from the Partner's domain.
const MAX_BYTES = 400_000;

function row(label: string, control: React.ReactNode, hint?: string) {
  return (
    <div key={label} className="grid gap-1.5 border-t border-line py-3 first:border-0 first:pt-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center sm:gap-4">
      <div><div className="text-[13px] font-medium">{label}</div>{hint && <div className="text-[12px] text-muted">{hint}</div>}</div>{control}
    </div>
  );
}

function Upload({ value, onChange, label, square, toast }: { value: string | null; onChange: (v: string | null) => void; label: string; square?: boolean; toast: (m: string) => void }) {
  const pick = (f?: File) => {
    if (!f) return;
    if (f.size > MAX_BYTES) return toast(`${f.name} is over ${MAX_BYTES / 1000} KB. Try an SVG or a smaller PNG`);
    const r = new FileReader();
    r.onload = () => onChange(r.result as string);
    r.readAsDataURL(f);
  };
  return (
    <div className="flex items-center gap-3">
      <span className={`grid shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-accent bg-accent-soft ${square ? "size-12" : "h-12 w-36"}`}>
        {value ? <img src={value} alt="" className="max-h-full max-w-full object-contain p-1.5" /> : <ImageUp size={16} className="text-accent" />}
      </span>
      <label className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-line bg-surface px-3 text-[13px] font-medium hover:bg-hover">
        {value ? "Replace" : "Upload"}
        <input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" aria-label={label} className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {value && <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={() => onChange(null)}>Remove</Button>}
    </div>
  );
}

function CopyHost({ host }: { host: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <code className="truncate font-mono text-[12.5px]">{host}</code>
      <button onClick={() => { navigator.clipboard?.writeText(`https://${host}`); setCopied(true); setTimeout(() => setCopied(false), 1200); }} aria-label="Copy address" className="shrink-0 rounded p-1 text-subtle hover:bg-hover hover:text-fg">{copied ? <Check size={12} className="text-good" /> : <Copy size={12} />}</button>
    </span>
  );
}

/** What a Client sees: the sidebar top, the assistant and a primary button. Live, since it reads the same brand as the app. */
function Preview() {
  return (
    <div aria-label="Preview" className="overflow-hidden rounded-xl border border-line bg-bg">
      <div className="flex items-center gap-2 border-b border-line bg-sidebar px-3 py-2.5"><Logo size={17} /></div>
      <div className="space-y-3 p-3">
        <div className="flex items-center gap-2 text-[13px]"><span className="grid size-6 place-items-center rounded-full bg-accent-soft text-accent"><Sparkles size={12} /></span><span className="font-medium whitespace-nowrap">{assistant()}</span><span className="text-muted">Drafted 3 review replies</span></div>
        <div className="flex items-center gap-2"><Button size="sm" variant="primary">Approve all</Button><Badge tone="accent">New</Badge></div>
        <div className="flex items-center gap-1.5 border-t border-line pt-2.5 text-[11.5px] text-subtle"><LogoMark size={12} /> Prepared by {partner?.name}</div>
      </div>
    </div>
  );
}

/**
 * The Partner's brand on everything its Clients see. One brand and one domain
 * for every Client; Organizations don't set their own.
 */
export default function Whitelabel() {
  const wl = useWhitelabel();
  const { toast, node } = useToast();
  const [host, setHost] = useState(wl.domain.host);
  const [checking, setChecking] = useState<"domain" | "email" | null>(null);
  if (!partner) return <></>;
  const fallback = fallbackHost(partner);
  const emailDomain = wl.email.address.split("@")[1] ?? "";
  const domainRecord = { type: "CNAME" as const, host: wl.domain.host, value: fallback, purpose: "Points your domain at the app", ok: wl.domain.status === "live" };
  const check = (what: "domain" | "email") => {
    setChecking(what);
    setTimeout(() => {
      setChecking(null);
      if (what === "domain") { setWhitelabel({ domain: { ...wl.domain, status: "live" } }); toast(`${wl.domain.host} is live, with SSL`); }
      else { setWhitelabel({ email: { ...wl.email, verified: true } }); toast(`Emails now come from ${wl.email.address}`); }
    }, 1300);
  };
  const connect = () => {
    const h = host.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h)) return toast("Enter a domain like app.youragency.com");
    setWhitelabel({ domain: { host: h, status: "dns" } });
  };

  return (
    <>
      <PageHeader title="Whitelabel" sub={`Your brand instead of ours, for every client of ${partner.name}: the app, reports, shared audits, emails and the assistant. Only ${partner.name} admins can change it.`} />
      <div className="max-w-3xl space-y-4">
        <Card>
          <div className="flex items-center gap-4">
            <div className="flex-1"><div className="text-[14px] font-medium">Whitelabel</div><div className="text-[12.5px] text-muted">{wl.on ? "On. Clients see your name, logo and colour everywhere, and never ours." : "Off. Clients see the standard app."}</div></div>
            <Toggle checked={wl.on} onChange={(on) => setWhitelabel({ on })} label="Whitelabel" />
          </div>
        </Card>

        <Card>
          <CardHeader title="Brand" sub="Changes show right away for everyone, in the app and in anything shared from now on." />
          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              {row("App name", <input value={wl.name} onChange={(e) => setWhitelabel({ name: e.target.value })} placeholder={partner.name} className={field} />, "Tab titles, emails, sign-in")}
              {row("Assistant name", <input value={wl.assistant} onChange={(e) => setWhitelabel({ assistant: e.target.value })} placeholder={DEFAULT_ASSISTANT} className={field} />, "Blank keeps “AI Assistant”")}
              {row("Logo", <Upload value={wl.logo} onChange={(logo) => setWhitelabel({ logo })} label="Upload logo" toast={toast} />, "Wide, for the sidebar and reports. SVG or PNG")}
              {row("Icon", <Upload square value={wl.icon} onChange={(icon) => setWhitelabel({ icon })} label="Upload icon" toast={toast} />, "Square, for the browser tab. Blank shows your initial")}
              {row("Accent colour", (
                <div className="flex items-center gap-2">
                  <input type="color" value={wl.accent} onChange={(e) => setWhitelabel({ accent: e.target.value })} aria-label="Accent colour" className={`h-9 w-12 cursor-pointer rounded-lg border border-line bg-surface p-1 ${focus}`} />
                  <input value={wl.accent} onChange={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && setWhitelabel({ accent: e.target.value })} aria-label="Accent colour hex" className={`${field} w-28 font-mono`} />
                </div>
              ), "Buttons, links and highlights")}
              {row("Support contact", <input value={wl.support} onChange={(e) => setWhitelabel({ support: e.target.value })} placeholder="help@youragency.com" className={field} />, "Where Help and “Contact support” go")}
            </div>
            <Preview />
          </div>
        </Card>

        <Card>
          <CardHeader title="Domain" sub="Where your clients open the app. One domain serves every client; they pick their business after signing in." />
          <div className="mt-4 space-y-4">
            {wl.domain.status === "none" ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input value={host} onChange={(e) => setHost(e.target.value)} onKeyDown={(e) => e.key === "Enter" && connect()} placeholder="app.youragency.com" aria-label="Custom domain" className={field} />
                <Button variant="primary" icon={<Globe size={13} />} onClick={connect}>Connect domain</Button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-medium">{wl.domain.host}</span>
                  {wl.domain.status === "live" ? <Badge tone="good"><Check size={10} />Live · SSL</Badge> : <Badge tone="warn">Waiting for DNS</Badge>}
                  <span className="ml-auto flex gap-2">
                    {wl.domain.status === "dns" && <Button size="sm" variant="primary" onClick={() => check("domain")} disabled={checking === "domain"}>{checking === "domain" ? "Checking…" : "Check DNS"}</Button>}
                    <Button size="sm" variant="ghost" onClick={() => { setWhitelabel({ domain: { host: "", status: "none" } }); setHost(""); }}>Remove</Button>
                  </span>
                </div>
                <p className="text-[12.5px] text-muted">Add this record where {wl.domain.host.split(".").slice(-2).join(".")} is hosted. We issue the SSL certificate once it's found, usually within minutes.</p>
                <DnsTable records={[domainRecord]} />
              </>
            )}
            {row("Fallback address", <CopyHost host={fallback} />, "Always works, with your brand, even if your domain's DNS breaks")}
          </div>
        </Card>

        <Card>
          <CardHeader title="Emails" sub="Invites, password resets, weekly digests and report emails your clients get." />
          <div className="mt-4">
            {row("Sender name", <input value={wl.email.sender} onChange={(e) => setWhitelabel({ email: { ...wl.email, sender: e.target.value } })} placeholder={partner.name} className={field} />)}
            {row("From address", (
              <div className="flex items-center gap-2">
                <input value={wl.email.address} onChange={(e) => setWhitelabel({ email: { ...wl.email, address: e.target.value.trim(), verified: false } })} placeholder="hello@youragency.com" aria-label="From address" className={field} />
                {emailDomain && (wl.email.verified ? <Badge tone="good"><Check size={10} />Verified</Badge> : <Badge tone="warn">Not verified</Badge>)}
              </div>
            ), "Until it's verified, emails come from your fallback address")}
          </div>
          {emailDomain.includes(".") && !wl.email.verified && (
            <div className="mt-3 space-y-3">
              <DnsTable records={dnsRecords("managed", emailDomain)} />
              <Button size="sm" variant="primary" icon={<Mail size={13} />} onClick={() => check("email")} disabled={checking === "email"}>{checking === "email" ? "Checking…" : "Verify"}</Button>
            </div>
          )}
        </Card>
      </div>
      {node}
    </>
  );
}

/** The Organizations this Partner manages. A Client can transfer out and keep everything. */
export function Clients() {
  const { orgId } = useScope();
  const [, bump] = useState(0);
  const [leaving, setLeaving] = useState<(typeof memberships)[number] | null>(null);
  const { toast, node } = useToast();
  if (!partner) return <></>;
  const transfer = () => {
    if (!leaving) return;
    memberships.splice(memberships.indexOf(leaving), 1);
    if (leaving.id === orgId && memberships[0]) setScope({ orgId: memberships[0].id, locationId: null });
    toast(`${leaving.name} transferred out`);
    setLeaving(null);
    bump((n) => n + 1);
  };
  return (
    <>
      <PageHeader title="Clients" sub={`Every organization ${partner.name} manages. They all get your whitelabel; none of them sets its own.`} />
      <Card pad={false} className="max-w-3xl">
        {memberships.map((m) => (
          <div key={m.id} className="flex items-center gap-3 border-b border-line px-5 py-3.5 last:border-0">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-hover text-[13px] font-semibold">{m.initial}</span>
            <div className="min-w-0 flex-1"><div className="truncate text-[14px]">{m.name}</div><div className="text-[12.5px] text-muted">{m.category} · {m.locations} location{m.locations === 1 ? "" : "s"}</div></div>
            <Button size="sm" variant="ghost" onClick={() => setLeaving(m)} disabled={memberships.length === 1}>Transfer out</Button>
          </div>
        ))}
      </Card>
      <Modal open={!!leaving} onClose={() => setLeaving(null)} title={`Transfer ${leaving?.name} out?`} footer={<><Button variant="ghost" onClick={() => setLeaving(null)}>Cancel</Button><Button variant="primary" onClick={transfer}>Transfer out</Button></>}>
        <p className="text-[13.5px] text-muted">{leaving?.name} keeps all its data, settings and history, and its own team keeps signing in. It stops seeing your brand, and nobody at {partner.name} can open it any more. You can't undo this; they'd have to invite you back.</p>
      </Modal>
      {node}
    </>
  );
}

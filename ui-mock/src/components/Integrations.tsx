import { useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, Check, ChevronRight, Code2, Loader2, Plug } from "lucide-react";
import { Badge, Button, Drawer, Field, Input, Modal, Select, cn, useToast } from "./ui";
import { EmailSetup, PhoneSetup } from "./Sending";
import { ConnectFlow } from "./Outreach";
import { ConnectToolModal } from "./Ads";
import { capabilityOf, providerOf, providersFor, type CapabilityId, type Provider, type ProviderId } from "../data/integrations";
import { featureOf } from "../data/features";
import { resources } from "../data/access";
import type { EmailProviderId, PhoneProviderId } from "../data/providers";
import type { ProviderId as SequencerId } from "../data/sequencers";
import {
  adToolOf, closeIntegration, connectGeneric, connectProvider, connectionsOf, disconnectConnection, flowOf, manageProvider, missingPermission, openTargets, providerName, replaces, servingOf, targetsOf, useConnections, useOpenIntegration,
  type Connection, type Target,
} from "../lib/integrations";
import { useAccess } from "../lib/access";
import { timeAgo } from "../lib/runs";

export function IntegrationMark({ p, size = 32 }: { p: Provider; size?: number }) {
  const dark = ["#ffde00", "#ff9900"].includes(p.color);
  return <span aria-hidden className="grid shrink-0 place-items-center rounded-lg font-semibold" style={{ width: size, height: size, background: p.color, color: dark ? "#111" : "#fff", fontSize: size * (p.mark.length > 2 ? 0.3 : 0.38) }}>{p.mark}</span>;
}

export function StatusBadge({ c }: { c: Connection }) {
  return c.status === "ok" ? <Badge tone="good"><Check size={10} />Connected</Badge> : <Badge tone={c.status === "action" ? "warn" : "info"}>{c.note ?? "Needs attention"}</Badge>;
}

const authLabel = (p: Provider) => (p.auth === "managed" ? "Nothing to sign up for" : p.auth === "oauth" ? "Sign in with " + p.name.split(" ")[0] : "API key");
const perLabel = (per: string, max: string) => (max === "many" ? "Any number" : per === "location" ? "One per location" : per === "website" ? "One per website" : per === "partner" ? "One for your agency" : "One per organization");

/** Why a provider can't be connected right now, or null. */
export function blockedReason(p: Provider, list: Connection[]) {
  const miss = missingPermission(p);
  if (miss) return `Your role can't ${resources[miss[0]].find((a) => a.id === miss[1])?.label.toLowerCase() ?? "connect this"}`;
  if (p.requires && !connectionsOf(list, p.requires).length) return `Connect ${providerOf(p.requires).name} first`;
  if (!openTargets(list, p).length) return "Connected everywhere it can be";
  return null;
}

// ---------- Inline: what powers a capability here ----------

/**
 * "Who sends email for this organization?" on the page that uses it. Shows
 * what's connected, or the providers that can do it. Managing opens the same
 * drawer as Settings → Integrations.
 */
export function CapabilityCard({ cap, target, title }: { cap: CapabilityId; target?: Target; title?: string }) {
  const list = useConnections();
  useAccess();
  const c = capabilityOf(cap);
  const serving = servingOf(list, cap, target);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div><div className="text-[14px] font-medium">{title ?? c.label}</div><div className="text-[12.5px] text-muted">{c.does}</div></div>
        <Link to={`/settings/integrations?cap=${cap}`} className="text-[12.5px] text-muted underline decoration-line-strong underline-offset-2 hover:text-fg">All integrations</Link>
      </div>
      {serving.length ? (
        <div className="divide-y divide-line rounded-lg border border-line">
          {serving.map((x) => { const p = providerOf(x.provider); return (
            <div key={x.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <IntegrationMark p={p} size={30} />
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium">{providerName(p)}<StatusBadge c={x} /></div><div className="truncate text-[12.5px] text-muted">{x.account}{x.target.kind !== "organization" ? ` · ${x.target.label}` : ""}</div></div>
              <Button size="sm" onClick={() => manageProvider(p.id)}>Manage</Button>
            </div>
          ); })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {providersFor(cap).map((p) => { const why = blockedReason(p, list); return (
            <button key={p.id} disabled={!!why} title={why ?? `Connect ${providerName(p)}`} onClick={() => connectProvider(p.id, target)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface pr-3 pl-1.5 text-[13px] hover:border-line-strong hover:bg-hover disabled:opacity-50 disabled:hover:bg-surface">
              <IntegrationMark p={p} size={24} />{providerName(p)}
            </button>
          ); })}
        </div>
      )}
    </div>
  );
}

/** A Location's or Website's connections, on its own Settings row. */
export function ConnectionsAt({ target }: { target: Target }) {
  const list = useConnections();
  useAccess();
  const here = (["gbp", "search_console", "ga4", "wordpress"] as ProviderId[]).map(providerOf).filter((p) => p.attach === target.kind);
  return (
    <div className="flex flex-wrap gap-1.5">
      {here.map((p) => {
        const c = list.find((x) => x.provider === p.id && x.target.id === target.id);
        const why = c ? null : blockedReason(p, list);
        return (
          <button key={p.id} onClick={() => (c ? manageProvider(p.id) : connectProvider(p.id, target))} disabled={!!why} title={why ?? undefined}
            className={cn("inline-flex h-8 items-center gap-2 rounded-full border pr-3 pl-1 text-[12.5px] disabled:opacity-50", c ? "border-line bg-surface hover:bg-hover" : "border-dashed border-line-strong text-muted hover:bg-hover hover:text-fg")}>
            <IntegrationMark p={p} size={22} />{p.name}{c ? <Check size={12} className="text-good" /> : <span className="text-subtle">Connect</span>}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Drawer and flows, mounted once ----------

/** Lives in the Layout, so any page can open a provider's drawer or connect flow. */
export function IntegrationHost() {
  const o = useOpenIntegration();
  const { toast, node } = useToast();
  const p = o.connect ? providerOf(o.connect.provider) : null;
  const flow = p && flowOf(p);
  return (
    <>
      {o.manage && <ManageDrawer p={providerOf(o.manage)} toast={toast} />}
      {p && flow === "email" && <EmailSetup open initial={(p.id === "managed_email" ? "managed" : p.id) as EmailProviderId} onClose={closeIntegration} toast={toast} />}
      {p && flow === "phone" && <PhoneSetup open initial={(p.id === "managed_phone" ? "managed" : p.id) as PhoneProviderId} onClose={closeIntegration} toast={toast} />}
      {p && flow === "sequencer" && <Modal open onClose={closeIntegration} title="Connect a sequencer" width={520}><ConnectFlow initial={p.id as SequencerId} onDone={closeIntegration} /></Modal>}
      {p && flow === "ad_tool" && <ConnectToolModal tool={adToolOf(p.id)} onClose={closeIntegration} />}
      {p && flow === "generic" && <GenericConnect p={p} initial={o.connect!.target} toast={toast} />}
      {node}
    </>
  );
}

function ManageDrawer({ p, toast }: { p: Provider; toast: (m: string) => void }) {
  const list = useConnections();
  useAccess();
  const mine = connectionsOf(list, p.id);
  const why = blockedReason(p, list);
  const [dev, setDev] = useState(false);
  const name = providerName(p);
  return (
    <Drawer open onClose={closeIntegration} width={600} title={<span className="flex items-center gap-2.5"><IntegrationMark p={p} size={28} />{name}</span>}
      footer={<div className="flex w-full items-center gap-2"><span className="flex-1 text-[12px] text-subtle">{authLabel(p)}{p.vendor ? ` · by ${p.vendor}` : ""}</span><Button onClick={closeIntegration}>Close</Button></div>}>
      <div className="space-y-6">
        <p className="text-[13.5px] text-muted">{p.blurb}</p>

        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-medium">{mine.length ? `Connected${mine.length > 1 ? ` · ${mine.length}` : ""}` : "Not connected"}</h3>
            <Button size="sm" variant={mine.length ? "secondary" : "primary"} icon={<Plug size={13} />} disabled={!!why} title={why ?? undefined} onClick={() => connectProvider(p.id)}>{mine.length ? (p.attach === "organization" || p.attach === "partner") && p.capabilities.every((c) => capabilityOf(c).max === "one") ? "Change" : "Connect another" : "Connect"}</Button>
          </div>
          {why && !mine.length && <p className="mb-2 text-[12.5px] text-muted">{why}.</p>}
          {mine.length > 0 && (
            <div className="divide-y divide-line rounded-lg border border-line">
              {mine.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[13.5px]">{c.account}<StatusBadge c={c} /></div>
                    <div className="text-[12px] text-muted">{c.target.kind === "organization" ? "Whole organization" : c.target.label}{c.note && c.status === "ok" ? ` · ${c.note}` : ""}{c.since ? ` · connected ${timeAgo(c.since)}` : ""}</div>
                  </div>
                  <Button size="sm" variant="ghost" disabled={!!missingPermission(p)} title={missingPermission(p) ? "Your role can't disconnect this" : undefined} onClick={() => { disconnectConnection(c); toast(`${name} disconnected${c.target.kind !== "organization" ? ` from ${c.target.label}` : ""}`); }}>Disconnect</Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-[13px] font-medium">What it powers</h3>
          <div className="divide-y divide-line rounded-lg border border-line">
            {p.capabilities.map((id) => {
              const c = capabilityOf(id);
              const others = c.max === "one" ? servingOf(list, id).filter((x) => x.provider !== p.id) : [];
              return (
                <div key={id} className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-[13.5px]">{c.label}<span className="text-[12px] text-subtle">· {perLabel(c.per, c.max)}</span></div>
                  <div className="text-[12.5px] text-muted">{c.does}</div>
                  {c.usedBy.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{c.usedBy.map((f) => { const ft = featureOf(f); return ft.links?.[0] ? <Link key={f} to={ft.links[0]} onClick={closeIntegration} className="rounded-full bg-hover px-2 py-0.5 text-[11.5px] text-muted hover:text-fg">{ft.label}</Link> : <span key={f} className="rounded-full bg-hover px-2 py-0.5 text-[11.5px] text-muted">{ft.label}</span>; })}</div>}
                  {others.length > 0 && <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted"><AlertTriangle size={12} className="text-warn" />{others.map((x) => providerName(providerOf(x.provider))).join(", ")} does this now. Connecting {name} replaces it.</div>}
                </div>
              );
            })}
          </div>
        </section>

        {(p.extras?.length || p.requires) && (
          <section>
            <h3 className="mb-2 text-[13px] font-medium">Also</h3>
            <div className="flex flex-wrap gap-1.5">
              {p.requires && <Badge>Needs {providerOf(p.requires).name}</Badge>}
              {p.extras?.map((e) => <Badge key={e}>{e}</Badge>)}
            </div>
          </section>
        )}

        <section>
          <button onClick={() => setDev(!dev)} aria-expanded={dev} className="flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-fg"><ChevronRight size={14} className={cn("transition-transform", dev && "rotate-90")} /><Code2 size={14} />For developers</button>
          {dev && (
            <div className="mt-2 space-y-2 rounded-lg bg-hover p-3 font-mono text-[11.5px] leading-relaxed">
              <div><span className="text-subtle">provider</span> {p.id} · <span className="text-subtle">auth</span> {p.auth} · <span className="text-subtle">attach</span> {p.attach}</div>
              {p.capabilities.map((id) => { const c = capabilityOf(id); return (
                <div key={id}>
                  <div className="text-fg">{id} <span className="text-subtle">({c.per}, {c.max})</span></div>
                  {c.ops.length > 0 && <div className="pl-3 text-muted">ops: {c.ops.join(", ")}</div>}
                  {c.events.length > 0 && <div className="pl-3 text-muted">events: {c.events.join(", ")}</div>}
                </div>
              ); })}
            </div>
          )}
        </section>
      </div>
    </Drawer>
  );
}

/** OAuth or API key, for providers without a setup flow of their own. */
function GenericConnect({ p, initial, toast }: { p: Provider; initial?: Target; toast: (m: string) => void }) {
  const list = useConnections();
  const open = openTargets(list, p);
  const [target, setTarget] = useState<Target | undefined>(initial ?? open[0]);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"form" | "auth" | "done">("form");
  const name = providerName(p);
  const replacing = target ? replaces(list, p, target) : [];
  const ready = !!target && (p.auth !== "api_key" || (p.fields ?? []).every((f) => keys[f.key]?.trim()));
  const account = p.auth === "api_key" ? `Key ••••${(keys[p.fields?.at(-1)?.key ?? ""] ?? "").slice(-4)}` : p.id === "slack" ? "#marketing" : p.category === "Social" ? `${p.name} account` : target?.label ?? "";
  const go = () => {
    if (!ready || !target) return;
    setStep("auth");
    setTimeout(() => { replacing.forEach(disconnectConnection); connectGeneric(p, target, account); setStep("done"); toast(`${name} connected`); }, p.auth === "oauth" ? 1100 : 600);
  };
  const choices = targetsOf(p.attach);
  return (
    <Modal open onClose={closeIntegration} title={<span className="flex items-center gap-2.5"><IntegrationMark p={p} size={26} />Connect {name}</span>} width={500}
      footer={step === "done" ? <Button variant="primary" onClick={closeIntegration}>Done</Button> : <><Button variant="ghost" onClick={closeIntegration}>Cancel</Button><Button variant="primary" disabled={!ready || step === "auth"} onClick={go}>{step === "auth" ? <><Loader2 size={13} className="animate-spin" />{p.auth === "oauth" ? `Waiting for ${p.name.split(" ")[0]}…` : "Checking…"}</> : p.auth === "oauth" ? `Continue with ${p.name.split(" ")[0]}` : "Connect"}</Button></>}>
      {step === "done" ? (
        <div className="space-y-3 text-[13.5px]">
          <p className="flex items-center gap-2 font-medium"><Check size={16} className="text-good" />{name} is connected{target && target.kind !== "organization" ? ` to ${target.label}` : ""}.</p>
          <p className="text-muted">Now powering:</p>
          <ul className="space-y-1">{p.capabilities.map((c) => <li key={c} className="flex items-start gap-2"><Check size={13} className="mt-0.5 shrink-0 text-good" /><span>{capabilityOf(c).label}<span className="text-muted"> · {capabilityOf(c).does}</span></span></li>)}</ul>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[13.5px] text-muted">{p.blurb}</p>
          {(p.attach === "location" || p.attach === "website") && (
            <Field label={p.attach === "location" ? "Location" : "Website"}>
              <Select value={target?.id ?? ""} onChange={(e) => setTarget(choices.find((t) => t.id === e.target.value))}>
                {choices.map((t) => <option key={t.id} value={t.id} disabled={!open.some((x) => x.id === t.id)}>{t.label}{open.some((x) => x.id === t.id) ? "" : " · already connected"}</option>)}
              </Select>
            </Field>
          )}
          {p.auth === "api_key" && (p.fields ?? []).map((f) => (
            <Field key={f.key} label={f.label}><Input type={f.secret ? "password" : "text"} value={keys[f.key] ?? ""} onChange={(e) => setKeys({ ...keys, [f.key]: e.target.value })} placeholder={f.placeholder} autoComplete="off" /></Field>
          ))}
          {replacing.length > 0 && <p className="flex items-start gap-2 text-[12.5px] text-muted"><AlertTriangle size={13} className="mt-0.5 shrink-0 text-warn" />Replaces {replacing.map((x) => providerName(providerOf(x.provider))).join(", ")}{target && target.kind !== "organization" ? ` on ${target.label}` : ""}.</p>}
          <div>
            <div className="mb-1.5 text-[12.5px] font-medium text-muted">It will</div>
            <ul className="space-y-1 text-[13px]">{p.capabilities.map((c) => <li key={c} className="flex items-start gap-2"><Check size={13} className="mt-0.5 shrink-0 text-muted" />{capabilityOf(c).does}</li>)}</ul>
          </div>
        </div>
      )}
    </Modal>
  );
}

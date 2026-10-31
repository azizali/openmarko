import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { Check, Plug } from "lucide-react";
import { Badge, Button, Card, Modal, PageHeader, Toggle, cn, useToast } from "../components/ui";
import { childrenOf, modules, type Connection, type Feature } from "../data/features";
import { member } from "../data/mock";
import { accounts } from "../data/social";
import { accountConnected, useSetup } from "../lib/setup";
import { useAds } from "../lib/ads";
import { useCrm } from "../lib/crm";
import { useOutreach } from "../lib/outreach";
import { chosen, knockOn, setFeature, statusOf, useFeatures } from "../lib/features";

/** Whether each kind of account a feature relies on is connected, and where to fix it. */
function useConnections(): Record<Connection, { ok: boolean; text: string; to: string }> {
  const setup = useSetup();
  const ads = useAds();
  const crm = useCrm();
  const out = useOutreach();
  const social = accounts.filter((a) => accountConnected(a.id, setup)).length;
  const adCount = (["meta", "google", "tiktok"] as const).filter((k) => ads.connected[k]).length;
  const { email, sms } = crm.channels;
  return {
    social_accounts: { ok: social > 0, text: social ? `${social} accounts connected` : "No accounts connected", to: "/settings/accounts" },
    ad_account: { ok: adCount > 0, text: adCount ? `${adCount} ad account${adCount > 1 ? "s" : ""} connected` : "No ad account connected", to: "/settings/ads" },
    email_sending: { ok: !!email.provider && email.verified, text: !email.provider ? "Not set up" : email.verified ? `Sending from ${email.domain}` : "Waiting for DNS", to: "/settings/messaging" },
    texting: { ok: !!sms.provider && sms.campaign === "approved", text: !sms.provider ? "Not set up" : sms.campaign === "approved" ? `${sms.numbers.length} numbers live` : "Registration in review", to: "/settings/messaging" },
    sequencer: { ok: !!out.connection, text: out.connection ? `${out.connection.workspace} connected` : "No sequencer connected", to: "/settings/outreach" },
  };
}

/**
 * Settings → Features: turn whole sections or single features on and off for
 * this Organization. Modules switch everything under them; some features need
 * another one (Campaigns needs Email or Texting). Each row says what else
 * changes when it's off, and turning off something others rely on asks first.
 */
export default function Features() {
  const flags = useFeatures();
  const conn = useConnections();
  const { hash } = useLocation();
  const { toast, node } = useToast();
  const [confirm, setConfirm] = useState<Feature | null>(null);
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" }); }, [hash]);
  const shown = modules.filter((m) => !m.agencyOnly || member.plan === "agency");
  const flip = (f: Feature, on: boolean) => {
    if (!on && knockOn(f.id).length) return setConfirm(f);
    setFeature(f.id, on);
    toast(`${f.label} ${on ? "on" : "off"}`);
  };

  const row = (f: Feature, isModule: boolean) => {
    const st = statusOf(f.id, flags);
    const c = f.connection ? conn[f.connection] : null;
    const parentOff = !isModule && !statusOf(f.module!, flags).on;
    return (
      <div key={f.id} className={cn("flex items-start gap-4", isModule ? "px-5 py-4" : "border-t border-line py-3 pr-5 pl-9", parentOff && "opacity-55")}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(isModule ? "text-[15px] font-medium" : "text-[13.5px] font-medium")}>{f.label}</span>
            {!st.on && st.why !== "Turned off" && !parentOff && <Badge tone="warn">{st.why}</Badge>}
            {c && st.on && (c.ok ? <Badge tone="good"><Check size={10} />{c.text}</Badge> : <Link to={c.to}><Badge tone="warn" className="hover:opacity-80"><Plug size={10} />{c.text} · Set up</Badge></Link>)}
          </div>
          <div className="text-[12.5px] text-muted">{f.blurb}</div>
          {f.off && <div className="mt-0.5 text-[12px] text-subtle">When off: {f.off}</div>}
        </div>
        <Toggle label={`${f.label} on`} checked={chosen(f.id, flags)} onChange={(v) => !parentOff && flip(f, v)} />
      </div>
    );
  };

  return (
    <>
      <PageHeader title="Features" sub="Turn parts of OpenMarko on or off for this organization. Turning something off hides it everywhere it appears, including inside other features. Nothing is deleted." />
      <div className="max-w-3xl space-y-4">
        {shown.map((m) => (
          <Card key={m.id} pad={false} className="scroll-mt-6">
            <div id={m.id} className="scroll-mt-6">{row(m, true)}</div>
            {childrenOf(m.id).map((f) => row(f, false))}
          </Card>
        ))}
        <p className="text-[12.5px] text-subtle">Connected means the account it relies on is linked. A feature that's on but not connected shows its own setup steps where you use it.</p>
      </div>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={`Turn off ${confirm?.label}?`}
        footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button><Button variant="danger" onClick={() => { setFeature(confirm!.id, false); toast(`${confirm!.label} off`); setConfirm(null); }}>Turn off</Button></>}>
        {confirm && (
          <div className="space-y-3 text-[13.5px]">
            <p>These stop working too, because they're part of it or rely on it:</p>
            <ul className="space-y-1">{knockOn(confirm.id).map((k) => <li key={k.id} className="flex items-start gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted" /><span><b className="font-medium">{k.label}</b>{k.off ? <span className="text-muted"> · {k.off}</span> : null}</span></li>)}</ul>
            {confirm.off && <p className="text-muted">Also: {confirm.off}</p>}
            <p className="text-[12.5px] text-subtle">Your data, settings and history stay. Turning it back on restores everything.</p>
          </div>
        )}
      </Modal>
      {node}
    </>
  );
}

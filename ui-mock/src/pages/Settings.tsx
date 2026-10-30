import { useState } from "react";
import { Store, SearchCheck, BarChart3, Database, Globe, Hash, Eye, EyeOff, Check } from "lucide-react";
import { Badge, Button, Card, CardHeader, PageHeader, Progress, Tabs, Toggle, useToast } from "../components/ui";
import { locations } from "../data/mock";

type Tab = "integrations" | "locations" | "automation" | "team" | "billing";

const integrations = [
  { icon: Store, name: "Google Business Profile", status: "Connected", detail: "2 locations · business.manage", ok: true },
  { icon: SearchCheck, name: "Google Search Console", status: "Connected", detail: "sc-domain:mapleandmaindental.com", ok: true },
  { icon: BarChart3, name: "Google Analytics 4", status: "Not connected", detail: "Attribute calls & bookings to SEO", ok: false },
  { icon: Globe, name: "WordPress", status: "Connected", detail: "Application password · Yoast detected", ok: true },
  { icon: Hash, name: "Slack", status: "Not connected", detail: "Alerts and weekly digests", ok: false },
];

export default function Settings() {
  const [tab, setTab] = useState<Tab>("integrations");
  const [show, setShow] = useState(false);
  const { toast, node } = useToast();
  const [auto, setAuto] = useState({ posts: true, alt: true, schema: false, categories: false, replies: false });

  return (
    <>
      <PageHeader title="Settings" />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "integrations", label: "Integrations" },
        { id: "locations", label: "Locations" },
        { id: "automation", label: "Automation" },
        { id: "team", label: "Team" },
        { id: "billing", label: "Usage & billing" },
      ]} />
      <div className="mt-6 max-w-3xl space-y-6">
        {tab === "integrations" && (
          <>
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
            <Card>
              <CardHeader title={<span className="flex items-center gap-2"><Database size={15} /> DataForSEO</span>} sub="Powers SERP tracking, keyword data, audits and business data. Credentials stay on the server." />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[13px]"><span className="mb-1 block text-muted">API login</span><input defaultValue="api@mapleandmain.com" className="h-9 w-full rounded-md border border-line bg-surface px-3 outline-none focus:border-line-strong" /></label>
                <label className="block text-[13px]"><span className="mb-1 block text-muted">API password</span>
                  <span className="flex h-9 items-center rounded-md border border-line bg-surface pr-1 focus-within:border-line-strong">
                    <input type={show ? "text" : "password"} defaultValue="d4f5e6a7b8c9" className="h-full flex-1 bg-transparent px-3 outline-none" />
                    <button onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="rounded p-1.5 text-muted hover:bg-hover">{show ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                  </span>
                </label>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="num text-[12.5px] text-muted">Balance: <b className="font-medium text-fg">$42.18</b> · ~$6.40 / month at current settings</span>
                <Button size="sm" onClick={() => toast("Connection OK · 200 from /v3/appendix/user_data")}>Test connection</Button>
              </div>
            </Card>
          </>
        )}

        {tab === "locations" && (
          <Card pad={false}>
            {locations.map((l, i) => (
              <div key={l.id} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
                <div className="min-w-0 flex-1"><div className="text-[14px] font-medium">{l.name}</div><div className="text-[12.5px] text-muted">{l.city} · {i ? "9" : "16"} keywords · 7×7 grid weekly</div></div>
                <Button size="sm" variant="ghost">Edit</Button>
              </div>
            ))}
          </Card>
        )}

        {tab === "automation" && (
          <Card>
            <CardHeader title="What OpenMarko can change without asking" sub="Everything else waits in To-do for approval." />
            {([
              ["posts", "Publish scheduled GBP posts", "Low risk"],
              ["alt", "Write image alt text on your site", "Low risk"],
              ["schema", "Add or update structured data", "Medium risk"],
              ["categories", "Change GBP categories or description", "High risk. Can trigger re-verification"],
              ["replies", "Reply to reviews", "Always reviewed by a person (recommended)"],
            ] as const).map(([k, l, d]) => (
              <div key={k} className="flex items-center gap-4 border-t border-line py-3.5 first:border-0">
                <div className="flex-1"><div className="text-[14px]">{l}</div><div className="text-[12.5px] text-muted">{d}</div></div>
                <Toggle label={l} checked={auto[k]} onChange={(v) => setAuto({ ...auto, [k]: v })} />
              </div>
            ))}
          </Card>
        )}

        {tab === "team" && (
          <Card pad={false}>
            {[["Dr. Anika Patel", "Owner"], ["Sam Ortiz", "Marketing · Editor"], ["Agency partner", "Viewer"]].map(([n, r]) => (
              <div key={n} className="flex items-center gap-3 border-b border-line px-5 py-3.5 last:border-0">
                <span className="grid size-8 place-items-center rounded-full bg-hover text-[12px] font-medium">{n.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
                <span className="flex-1 text-[14px]">{n}</span>
                <span className="text-[12.5px] text-muted">{r}</span>
              </div>
            ))}
            <div className="border-t border-line px-5 py-3"><Button size="sm">Invite teammate</Button></div>
          </Card>
        )}

        {tab === "billing" && (
          <Card>
            <CardHeader title="Growth plan" sub="$79 / month · renews Nov 14" right={<Button size="sm">Change plan</Button>} />
            {[["Tracked keywords", 16, 25], ["Locations", 2, 3], ["Grid scans this month", 38, 100], ["Auto-applied changes", 11, 50]].map(([l, u, t]) => (
              <div key={l as string} className="mt-4">
                <div className="mb-1.5 flex justify-between text-[13px]"><span>{l}</span><span className="num text-muted">{u} / {t}</span></div>
                <Progress value={((u as number) / (t as number)) * 100} />
              </div>
            ))}
          </Card>
        )}
      </div>
      {node}
    </>
  );
}

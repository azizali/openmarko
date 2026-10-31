import { useState } from "react";
import { Link } from "react-router";
import { Wand2, ChevronRight } from "lucide-react";
import { Badge, Card, CardHeader, Delta, PageHeader, ScoreRing, Tabs, cn } from "../components/ui";
import { type Severity } from "../data/mock";
import { websiteData } from "../data/scoped";
import { ExternalUrl, ScopeBar, WebsiteOverview } from "../components/Scope";
import { useScopedLocation, useScopedWebsite } from "../lib/scope";
import { Needs } from "../components/Needs";

const sevTone = { critical: "bad", warning: "warn", notice: "info" } as const;
const cats = ["All", "Technical", "On-page", "Local", "Performance", "Content"] as const;

// Site health belongs to a Website. "All websites" compares them.
export default function Audit() {
  const { website, missing } = useScopedWebsite();
  const { location } = useScopedLocation();
  return (
    <>
      <PageHeader
        title="Site audit"
        sub={website
          ? <><ExternalUrl domain={website.domain} /> · {websiteData[website.id].summary.pages} pages · crawled {websiteData[website.id].summary.crawled} in {websiteData[website.id].summary.duration}</>
          : "Every website the organization owns, checked weekly."}
      />
      <ScopeBar kind="website" />
      {website ? <AuditBody key={website.id} websiteId={website.id} /> : missing ? <Needs kind="website" locationId={location?.id} note="Site health is checked on a website." /> : (
        <WebsiteOverview
          columns={["Site health", "Critical", "Warnings", "Pages"]}
          row={(w) => {
            const d = websiteData[w.id];
            const n = (s: Severity) => d.issues.filter((i) => i.severity === s).length;
            return [<span className={d.summary.score >= 80 ? "text-good" : "text-warn"}>{d.summary.score}</span>, n("critical") ? <Badge tone="bad">{n("critical")}</Badge> : "0", n("warning"), d.summary.pages];
          }}
        />
      )}
    </>
  );
}

function AuditBody({ websiteId }: { websiteId: string }) {
  const { summary: auditSummary, issues: auditIssues } = websiteData[websiteId];
  const [sev, setSev] = useState<"all" | Severity>("all");
  const [cat, setCat] = useState<(typeof cats)[number]>("All");
  const list = auditIssues.filter((i) => (sev === "all" || i.severity === sev) && (cat === "All" || i.category === cat));
  const count = (s: Severity) => auditIssues.filter((i) => i.severity === s).length;

  const vitals = [
    { label: "LCP", value: `${auditSummary.lcp}s`, ok: auditSummary.lcp <= 2.5, target: "≤ 2.5s" },
    { label: "INP", value: `${auditSummary.inp}ms`, ok: auditSummary.inp <= 200, target: "≤ 200ms" },
    { label: "CLS", value: auditSummary.cls.toFixed(2), ok: auditSummary.cls <= 0.1, target: "≤ 0.1" },
  ];

  return (
    <>
      <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="flex items-center gap-6">
          <ScoreRing score={auditSummary.score} size={88} stroke={7} label="Site health" />
          <div>
            <div className="text-[12.5px] text-muted">Site health</div>
            <div className="mt-1 flex items-center gap-2"><Delta cur={auditSummary.score} prev={auditSummary.prevScore} suffix=" pts" /><span className="text-[12.5px] text-muted">since Oct 21</span></div>
            <div className="mt-3 flex gap-2">
              <Badge tone="bad">{count("critical")} critical</Badge>
              <Badge tone="warn">{count("warning")} warnings</Badge>
              <Badge tone="info">{count("notice")} notices</Badge>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Core Web Vitals" sub="Mobile · field data where available, otherwise Lighthouse" />
          <div className="grid grid-cols-3 gap-4">
            {vitals.map((v) => (
              <div key={v.label}>
                <div className="text-[12.5px] text-muted">{v.label}</div>
                <div className={cn("num mt-1 font-serif text-[24px] leading-none", v.ok ? "text-good" : "text-warn")}>{v.value}</div>
                <div className="mt-1 text-[11.5px] text-subtle">{v.target}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Tabs value={sev} onChange={setSev} tabs={[
        { id: "all", label: "All issues", count: auditIssues.length },
        { id: "critical", label: "Critical", count: count("critical") },
        { id: "warning", label: "Warnings", count: count("warning") },
        { id: "notice", label: "Notices", count: count("notice") },
      ]} />
      <div className="my-4 flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={cn("h-7 rounded-full border px-3 text-[12.5px] transition-colors", cat === c ? "border-ink bg-ink text-on-ink" : "border-line text-muted hover:bg-hover")}>{c}</button>
        ))}
      </div>

      <Card pad={false}>
        {list.map((i) => (
          <Link key={i.id} to={`/audit/${i.id}`} className="group flex items-center gap-4 border-b border-line px-5 py-3.5 last:border-0 hover:bg-hover">
            <Badge tone={sevTone[i.severity]} className="w-[68px] justify-center capitalize">{i.severity}</Badge>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-medium">{i.title}</div>
              <div className="text-[12.5px] text-muted">{i.category} · {i.pages.length} page{i.pages.length > 1 ? "s" : ""}</div>
            </div>
            {i.autoFix && <Badge tone="info" className="hidden sm:inline-flex"><Wand2 size={11} /> Auto-fix · {i.autoFix.executor}</Badge>}
            <ChevronRight size={16} className="text-subtle" />
          </Link>
        ))}
        {!list.length && <div className="py-12 text-center text-[13px] text-muted">Nothing here. Nice.</div>}
      </Card>
    </>
  );
}

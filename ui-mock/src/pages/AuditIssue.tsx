import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ChevronRight, Wand2, Check, Loader2, FileCode, ExternalLink, ClipboardCopy } from "lucide-react";
import { Badge, Button, Card, CardHeader, PageHeader, cn, useToast } from "../components/ui";
import { auditIssues } from "../data/mock";

const sevTone = { critical: "bad", warning: "warn", notice: "info" } as const;
const execSteps = ["Connecting to WordPress (REST API)", "Applying change", "Purging page cache", "Re-crawling affected pages", "Requesting indexing in Search Console"];

export default function AuditIssue() {
  const { id } = useParams();
  const issue = auditIssues.find((i) => i.id === id) ?? auditIssues[0];
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set(issue.pages));
  const { toast, node } = useToast();

  useEffect(() => { setPhase("idle"); setStep(0); setSelected(new Set(issue.pages)); }, [issue.id]);
  useEffect(() => {
    if (phase !== "running") return;
    if (step >= execSteps.length) { setPhase("done"); return; }
    const t = setTimeout(() => setStep((s) => s + 1), 700);
    return () => clearTimeout(t);
  }, [phase, step]);

  return (
    <>
      <PageHeader
        crumbs={<span className="flex items-center gap-1"><Link to="/audit" className="hover:text-fg">Site audit</Link><ChevronRight size={12} />{issue.category}</span>}
        title={issue.title}
        sub={<span className="flex items-center gap-2"><Badge tone={sevTone[issue.severity]} className="capitalize">{issue.severity}</Badge>{issue.pages.length} affected page{issue.pages.length > 1 ? "s" : ""}</span>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Why it matters" />
            <p className="text-[14px] leading-relaxed">{issue.why}</p>
            <div className="mt-5 mb-2 text-[13px] font-medium">Recommended fix</div>
            <p className="text-[14px] leading-relaxed text-muted">{issue.fix}</p>
          </Card>

          {issue.autoFix ? (
            <Card pad={false}>
              <div className="flex items-center justify-between px-5 pt-5">
                <div className="flex items-center gap-2 text-[14px] font-medium"><FileCode size={15} /> Proposed change</div>
                <button onClick={() => { navigator.clipboard?.writeText(issue.autoFix!.after); toast("Copied to clipboard"); }} className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-fg"><ClipboardCopy size={12} /> Copy</button>
              </div>
              <div className="mt-4 border-t border-line font-mono text-[12.5px] leading-relaxed">
                <pre className="overflow-x-auto bg-bad-soft/50 px-5 py-3 whitespace-pre-wrap text-bad">- {issue.autoFix.before}</pre>
                <pre className="overflow-x-auto bg-good-soft/50 px-5 py-3 whitespace-pre-wrap text-good">{issue.autoFix.after.split("\n").map((l) => `+ ${l}`).join("\n")}</pre>
              </div>
            </Card>
          ) : (
            <Card className="text-[13.5px] text-muted">This fix needs a developer or designer. Assign it to a teammate, or export it as a task.</Card>
          )}

          <Card pad={false}>
            <div className="px-5 pt-5"><CardHeader title="Affected pages" sub="Choose which pages to fix" /></div>
            {issue.pages.map((p) => (
              <label key={p} className="flex cursor-pointer items-center gap-3 border-t border-line px-5 py-2.5 text-[13.5px] hover:bg-hover">
                <input type="checkbox" checked={selected.has(p)} onChange={() => { const n = new Set(selected); n.has(p) ? n.delete(p) : n.add(p); setSelected(n); }} className="size-4 accent-[var(--ink)]" disabled={phase !== "idle" || !issue.autoFix} />
                <span className="flex-1 font-mono text-[12.5px]">mapleandmaindental.com{p}</span>
                <ExternalLink size={12} className="text-subtle" />
              </label>
            ))}
          </Card>
        </div>

        <div className="lg:sticky lg:top-8 lg:self-start">
          <Card>
            {issue.autoFix ? (
              <>
                <div className="flex items-center gap-2 text-[14px] font-medium"><Wand2 size={15} className="text-accent" /> Apply automatically</div>
                <p className="mt-1.5 text-[13px] text-muted">OpenMarko will apply this through your connected {issue.autoFix.executor} site. A revision is saved so you can roll back.</p>
                {phase === "idle" && (
                  <Button variant="primary" className="mt-5 w-full" disabled={!selected.size} onClick={() => setPhase("running")}>
                    Apply to {selected.size} page{selected.size === 1 ? "" : "s"}
                  </Button>
                )}
                {phase !== "idle" && (
                  <ul className="mt-5 space-y-2.5">
                    {execSteps.map((s, i) => (
                      <li key={s} className={cn("flex items-center gap-2.5 text-[13px]", i > step && "opacity-40")}>
                        {i < step ? <Check size={14} className="text-good" /> : i === step && phase === "running" ? <Loader2 size={14} className="animate-spin" /> : <span className="grid size-3.5 place-items-center"><span className="size-1.5 rounded-full bg-line-strong" /></span>}
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
                {phase === "done" && (
                  <div className="anim-fade mt-5 rounded-lg bg-good-soft p-3 text-[13px] text-good">
                    Fixed on {selected.size} page{selected.size === 1 ? "" : "s"}. We'll measure the ranking impact over the next 14 days.
                    <button onClick={() => { setPhase("idle"); setStep(0); toast("Rolled back to previous revision"); }} className="mt-2 block text-[12.5px] underline">Roll back</button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-[14px] font-medium">Manual fix</div>
                <Button className="mt-4 w-full" onClick={() => toast("Task assigned to Dev team")}>Assign to teammate</Button>
                <Button variant="ghost" className="mt-2 w-full" onClick={() => toast("Marked as fixed. We'll verify on the next crawl")}>Mark as fixed</Button>
              </>
            )}
          </Card>
          <Link to="/todo" className="mt-3 block text-center text-[12.5px] text-muted hover:text-fg">See everything in To-do →</Link>
        </div>
      </div>
      {node}
    </>
  );
}

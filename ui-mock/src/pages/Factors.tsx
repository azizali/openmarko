import { useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ArrowRight, Info } from "lucide-react";
import { Card, PageHeader, Progress, ScoreRing, cn } from "../components/ui";
import { factorGroups, type FactorStatus } from "../data/mock";

const statusIcon: Record<FactorStatus, React.ReactNode> = {
  good: <CheckCircle2 size={16} className="text-good" />,
  warn: <AlertTriangle size={16} className="text-warn" />,
  bad: <XCircle size={16} className="text-bad" />,
};

export default function Factors() {
  const [open, setOpen] = useState<string | null>("gbp");
  const total = Math.round(factorGroups.reduce((a, g) => a + g.score * g.weight, 0) / factorGroups.reduce((a, g) => a + g.weight, 0));

  return (
    <>
      <PageHeader title="Ranking factors" sub="What drives local rankings, scored against the businesses that beat you in the map pack." />

      <Card className="mb-6 flex flex-wrap items-center gap-8">
        <ScoreRing score={total} size={96} stroke={7} label="Local SEO score" />
        <div className="min-w-0 flex-1">
          <div className="font-serif text-[22px] leading-snug">Your Business Profile and reviews are where the biggest gains are.</div>
          <p className="mt-1.5 text-[13.5px] text-muted">Score is weighted by each factor group's estimated influence on map pack rankings. Proximity is shown for context but you can't change it.</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-x-8 gap-y-3 sm:w-auto">
          {factorGroups.slice(0, 6).map((g) => (
            <div key={g.id} className="w-full sm:w-40">
              <div className="mb-1 flex justify-between text-[12.5px]"><span className="truncate text-muted">{g.name}</span><span className="num">{g.score}</span></div>
              <Progress value={g.score} tone={g.score >= 75 ? "good" : g.score >= 60 ? "warn" : "bad"} />
            </div>
          ))}
        </div>
      </Card>

      <div className="space-y-2">
        {factorGroups.map((g) => {
          const isOpen = open === g.id;
          const issues = g.factors.filter((f) => f.status !== "good").length;
          return (
            <Card key={g.id} pad={false}>
              <button onClick={() => setOpen(isOpen ? null : g.id)} aria-expanded={isOpen} className="flex w-full items-center gap-4 px-5 py-4 text-left">
                <ScoreRing score={g.score} size={40} stroke={4} label={g.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-medium">{g.name} <span className="num text-[12px] font-normal text-subtle">~{g.weight}% weight</span></div>
                  <div className="truncate text-[13px] text-muted">{g.summary}</div>
                </div>
                {issues > 0 && <span className="num hidden text-[12.5px] text-muted sm:block">{issues} to improve</span>}
                <ChevronDown size={16} className={cn("text-subtle transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <ul className="anim-fade border-t border-line">
                  {g.factors.map((f) => (
                    <li key={f.name} className="flex items-start gap-3 border-b border-line px-5 py-3 last:border-0">
                      <span className="mt-0.5">{statusIcon[f.status]}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-medium">{f.name}</div>
                        <div className="text-[13px] text-muted">{f.detail}</div>
                      </div>
                      {f.actionId && (
                        <Link to={`/todo?task=${f.actionId}`} className="inline-flex shrink-0 items-center gap-1 text-[13px] text-accent hover:underline">Fix <ArrowRight size={13} /></Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-[12px] text-subtle"><Info size={12} /> Weights are estimates based on published industry surveys of local search factors, and are tuned per category over time.</p>
    </>
  );
}

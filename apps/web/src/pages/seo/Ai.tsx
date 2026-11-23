// AI answers (/seo/ai): whether the AI assistants recommend the business. A headline (answers that name you, over
// 90 days), a table of question × assistant that opens to each answer, and the sites the answers lean on.
import { Fragment, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { Badge, Button, Card, cn } from "../../components/ui";
import { LoadError, useToast } from "../../components/Feedback";
import { messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { engineNames, locationApi, seoApi, type AiPage } from "./api";
import { AddQuestions } from "./AddDrawers";
import { Headline, Source } from "./parts";
import { kindsOf, useAfterCheck, useReloadWhilePending } from "./checks";
import { SeoHeader, useSeo } from "./Seo";

type Question = AiPage["questions"][number];
type Answer = NonNullable<Question["answers"][string]>;

function Cell({ answer }: { answer: Answer | null | undefined }) {
  if (!answer) return <span className="text-muted">—</span>;
  if (!answer.namedYou) return <span className="text-muted">—</span>;
  return <Badge tone="good">{answer.position ? `#${answer.position}` : "Named"}</Badge>;
}

function AnswerCard({ engine, answer }: { engine: string; answer: Answer | null | undefined }) {
  return (
    <div className="min-w-0 border-t border-line pt-3">
      <p className="flex items-center justify-between gap-2 text-[13px] font-medium">
        {engineNames[engine] ?? engine}
        {answer && <Badge tone={answer.namedYou ? "good" : "neutral"}>{answer.namedYou ? "Names you" : "Doesn't name you"}</Badge>}
      </p>
      {!answer ? (
        <p className="mt-2 text-[13px] text-muted">No answer yet.</p>
      ) : (
        <>
          <p className="mt-2 text-[13px] text-muted">“{answer.excerpt}”</p>
          {answer.named.length > 0 && (
            <ol className="mt-3 space-y-0.5 text-[13px]">
              {answer.named.map((n, i) => (
                <li key={n.name} className={cn("flex gap-2", n.isYou && "font-medium")}>
                  <span className="num w-4 shrink-0 text-muted">{i + 1}</span>
                  {n.isYou ? "You" : n.name}
                </li>
              ))}
            </ol>
          )}
          {answer.cites.length > 0 && <p className="mt-3 text-[12.5px] text-muted">Cites {answer.cites.join(", ")}</p>}
        </>
      )}
    </div>
  );
}

const th = "px-3 py-2 font-normal";

export default function Ai() {
  const { orgId, location, can } = useSeo();
  const page = useLoad(() => locationApi(orgId, location.id).results.ai.get(), [orgId, location.id]);
  const limits = useLoad(() => seoApi(orgId).limits.get(), [orgId]);
  useReloadWhilePending(!!page.data?.questions.some((q) => q.pending), page.reload);
  useAfterCheck(kindsOf.ai, page.reload);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const toast = useToast();

  const stop = async (q: Question) => {
    const here = locationApi(orgId, location.id);
    const r = await here.questions({ questionId: q.id }).delete();
    if (r.error) return toast.error(messageOf(r.error), "Could not stop asking");
    toast.success("Stopped asking it", "Its history is kept.", {
      label: "Undo",
      run: () =>
        void here.questions.post({ texts: [q.text] }).then((u) => {
          if (u.error) toast.error(messageOf(u.error), "Could not undo");
          void page.reload();
        }),
    });
    void page.reload();
  };

  const data = page.data;
  return (
    <>
      <SeoHeader
        tab="ai"
        sub="Whether ChatGPT, Google AI and Perplexity recommend you."
        actions={
          can("track") && (
            <Button icon={<Plus size={14} />} onClick={() => setAdding(true)}>
              Add questions
            </Button>
          )
        }
      />
      <LoadError what="AI answers">{page.error}</LoadError>
      {data && (
        <>
          <Headline
            label="Answers that name you"
            value={data.named}
            of={data.total}
            change={data.namedBefore === null ? null : data.named - data.namedBefore}
            unit="more"
            history={data.history}
          />
          <Card pad={false} className="mt-4 overflow-x-auto">
            <table className="w-full min-w-160 text-[13.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[12.5px] text-muted">
                  <th className={cn(th, "pl-4")}>Question</th>
                  {data.byEngine.map((e) => (
                    <th key={e.engine} className={cn(th, "text-center")}>
                      {engineNames[e.engine] ?? e.engine}
                      <span className="num block">
                        {e.named} of {e.total}
                      </span>
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {data.questions.length === 0 && (
                  <tr>
                    <td colSpan={data.engines.length + 2} className="px-4 py-6 text-center text-muted">
                      No questions yet.
                    </td>
                  </tr>
                )}
                {data.questions.map((q) => {
                  const isOpen = open === q.id;
                  return (
                    <Fragment key={q.id}>
                      <tr
                        className={cn("cursor-pointer border-b border-line last:border-0 hover:bg-hover", isOpen && "bg-hover")}
                        onClick={() => setOpen(isOpen ? null : q.id)}
                      >
                        <td className={cn(th, "pl-4")}>
                          <button type="button" aria-expanded={isOpen} className="text-left font-medium">
                            {q.text}
                          </button>
                          {q.pending && <span className="block text-[12px] text-muted">First answers in a few minutes</span>}
                        </td>
                        {data.engines.map((e) => (
                          <td key={e} className={cn(th, "text-center")}>
                            <Cell answer={q.answers[e]} />
                          </td>
                        ))}
                        <td className="pr-3">
                          <ChevronRight size={15} className={cn("text-subtle transition-transform", isOpen && "rotate-90")} aria-hidden />
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-line last:border-0">
                          <td colSpan={data.engines.length + 2} className="px-4 pt-1 pb-4">
                            <div className="grid gap-3 md:grid-cols-3">
                              {data.engines.map((e) => (
                                <AnswerCard key={e} engine={e} answer={q.answers[e]} />
                              ))}
                            </div>
                            {can("track") && (
                              <Button variant="ghost" size="sm" className="mt-2" onClick={() => void stop(q)}>
                                Stop asking
                              </Button>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </Card>
          {data.topCites.length > 0 && (
            <Card className="mt-4">
              <h2 className="text-[14px] font-medium">Sites AI answers lean on</h2>
              <p className="mt-0.5 text-[13px] text-muted">Being listed on these is how a business gets named.</p>
              <ul className="mt-3 divide-y divide-line text-[13.5px]">
                {data.topCites.map((c) => (
                  <li key={c.domain} className="flex items-center justify-between gap-3 py-2">
                    <span className="truncate">{c.domain}</span>
                    <span className="num shrink-0 text-muted">
                      {c.count} {c.count === 1 ? "answer" : "answers"}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
      <Source>
        ChatGPT's answer as a person sees it, Google's AI Overview, and Perplexity, asked from the business's location, through DataForSEO's
        AI Optimization API. A business counts as named when its name appears in the answer.
      </Source>
      <AddQuestions
        open={adding}
        onClose={() => setAdding(false)}
        tracked={data?.questions.map((q) => q.text) ?? []}
        limit={limits.data?.questions ?? null}
        onAdded={() => void page.reload()}
      />
    </>
  );
}

// AI answers (/seo/ai): whether the AI assistants recommend the business. One table of question × assistant, and the
// sites the answers lean on. A question opens its own page (/seo/ai/<questionId>): every assistant's answer in full,
// who it named in order, and what it cited, with breadcrumbs back up.
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ChevronRight } from "lucide-react";
import { Badge, Button, Card, NewButton, cn } from "../../components/ui";
import { LoadError, useToast } from "../../components/Feedback";
import { messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { engineNames, locationApi, seoApi, type AiPage } from "./api";
import { AddQuestions } from "./AddDrawers";
import { Change, EngineName, Marked, Source, stack } from "./parts";
import { kindsOf, useAfterCheck, useReloadWhilePending } from "./checks";
import { SeoHeader, useSeo, useSeoHref } from "./Seo";

type Question = AiPage["questions"][number];
type Answer = NonNullable<Question["answers"][string]>;

const source = (
  <Source>
    ChatGPT's answer as a person sees it, Google's AI Overview, and Perplexity, asked from the business's location, through DataForSEO's AI
    Optimization API. A business counts as named when its name appears in the answer.
  </Source>
);

export default function Ai() {
  const id = useParams()["*"];
  return id ? <QuestionPage key={id} id={id} /> : <QuestionList />;
}

function useAiPage() {
  const { orgId, location } = useSeo();
  const page = useLoad(() => locationApi(orgId, location.id).results.ai.get(), [orgId, location.id]);
  useReloadWhilePending(!!page.data?.questions.some((q) => q.pending), page.reload);
  useAfterCheck(kindsOf.ai, page.reload);
  return page;
}

/** One assistant's answer in a word: not asked yet, asked and you're not in it, or where you are in it. */
function Cell({ answer }: { answer: Answer | null | undefined }) {
  if (!answer) return <span className="text-[12.5px] text-subtle">Waiting</span>;
  if (!answer.namedYou) return <Badge tone="bad">Not named</Badge>;
  return <Badge tone="good">{answer.position ? `Named #${answer.position}` : "Named"}</Badge>;
}

const th = stack.pad;

// ---------- All questions ----------

function QuestionList() {
  const { orgId, can } = useSeo();
  const page = useAiPage();
  const limits = useLoad(() => seoApi(orgId).limits.get(), [orgId]);
  const [adding, setAdding] = useState(false);
  const href = useSeoHref();
  const navigate = useNavigate();

  const data = page.data;
  return (
    <>
      <SeoHeader
        tab="ai"
        suggestions="ai"
        sub={
          data && data.total ? (
            <>
              <span className="text-fg">
                {data.named} of {data.total} answers name you
              </span>
              {data.namedBefore !== null && (
                <>
                  {" · "}
                  <Change by={data.named - data.namedBefore} unit="more" none="no change in 30 days" />
                </>
              )}
            </>
          ) : (
            "Whether ChatGPT, Google AI and Perplexity recommend you."
          )
        }
        actions={can("track") && <NewButton onClick={() => setAdding(true)}>Add questions</NewButton>}
      />
      <LoadError what="AI answers">{page.error}</LoadError>
      {data && (
        <div className="space-y-6">
          <Card pad={false} className="overflow-x-auto">
            <table role="table" className={stack.table}>
              <thead role="rowgroup" className={stack.head}>
                <tr className="border-b border-line text-left text-[12.5px] text-muted">
                  <th className={cn(th, "pl-4")}>Question</th>
                  {data.engines.map((e) => (
                    <th key={e} className={cn(th, "text-center")}>
                      <EngineName engine={e} />
                    </th>
                  ))}
                  <th className={th}>Cites</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody role="rowgroup" className={stack.body}>
                {data.questions.length === 0 && (
                  <tr>
                    <td colSpan={data.engines.length + 3} className="px-4 py-6 text-center text-muted">
                      No questions yet.
                    </td>
                  </tr>
                )}
                {data.questions.map((q) => {
                  const to = href(`/seo/ai/${q.id}`);
                  const cites = [...new Set(Object.values(q.answers).flatMap((a) => a?.cites ?? []))];
                  return (
                    <tr
                      key={q.id}
                      role="row"
                      className={cn("cursor-pointer border-b border-line last:border-0 hover:bg-hover", stack.row)}
                      onClick={() => navigate(to)}
                    >
                      <td role="cell" className={cn(th, "pl-4 font-medium", stack.first)}>
                        <Link to={to} onClick={(e) => e.stopPropagation()} className="underline-offset-2 hover:underline">
                          {q.text}
                        </Link>
                        {q.pending && <span className="block text-[12px] font-normal text-muted">First answers in a few minutes</span>}
                      </td>
                      {data.engines.map((e) => (
                        <td key={e} role="cell" data-label={engineNames[e] ?? e} className={cn(th, "text-center", stack.cell)}>
                          <Cell answer={q.answers[e]} />
                        </td>
                      ))}
                      <td
                        role="cell"
                        data-label="Cites"
                        className={cn(th, "max-w-56 truncate text-muted", stack.cell, "max-sm:max-w-none")}
                      >
                        {cites.length ? cites.slice(0, 3).join(", ") + (cites.length > 3 ? ` +${cites.length - 3}` : "") : "—"}
                      </td>
                      <td role="cell" className={cn("pr-3", stack.hide)}>
                        <ChevronRight size={15} className="text-subtle" aria-hidden />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {data.total > 0 && (
                <tfoot role="rowgroup" className={stack.body}>
                  <tr role="row" className={cn(stack.total, stack.row)}>
                    <td role="cell" className={cn(th, "pl-4", stack.first)}>
                      All {data.questions.length} questions
                    </td>
                    {data.byEngine.map((e) => (
                      <td
                        key={e.engine}
                        role="cell"
                        data-label={engineNames[e.engine] ?? e.engine}
                        className={cn(th, "num text-center", stack.cell)}
                      >
                        {e.named}
                        <span className="font-normal text-muted"> of {e.total}</span>
                      </td>
                    ))}
                    <td role="cell" className={stack.hide} />
                    <td role="cell" className={stack.hide} />
                  </tr>
                </tfoot>
              )}
            </table>
          </Card>
          {data.topCites.length > 0 && (
            <Card pad={false}>
              <div className="px-4 pt-4">
                <h2 className="text-[14px] font-medium">Sites AI answers lean on</h2>
                <p className="mt-0.5 text-[13px] text-muted">Being listed on these is how a business gets named.</p>
              </div>
              <ul className="mt-2 divide-y divide-line text-[13.5px]">
                {data.topCites.map((c) => (
                  <li key={c.domain} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="truncate">{c.domain}</span>
                    <span className="num shrink-0 text-muted">
                      {c.count} {c.count === 1 ? "answer" : "answers"}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
      {source}
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

// ---------- One question ----------

function QuestionPage({ id }: { id: string }) {
  const { orgId, location, can } = useSeo();
  const page = useAiPage();
  const toast = useToast();
  const href = useSeoHref();
  const navigate = useNavigate();
  const q = page.data?.questions.find((x) => x.id === id);

  if (page.error) return <LoadError what="this question">{page.error}</LoadError>;
  if (!page.data) return null;
  if (!q)
    return (
      <>
        <SeoHeader tab="ai" title="Question not found" trail={[{ label: "Not found" }]} sub="" switcher={false} />
        <Card>
          <p className="text-[13.5px]">This question isn't asked for {location.name}.</p>
          <Link to={href("/seo/ai")} className="mt-2 inline-block text-[13px] underline underline-offset-2">
            All questions
          </Link>
        </Card>
      </>
    );

  const stop = async () => {
    const here = locationApi(orgId, location.id);
    const r = await here.questions({ questionId: q.id }).delete();
    if (r.error) return toast.error(messageOf(r.error), "Could not stop asking");
    toast.success("Stopped asking it", "Its history is kept.", {
      label: "Undo",
      run: () =>
        void here.questions.post({ texts: [q.text] }).then((u) => {
          if (u.error) toast.error(messageOf(u.error), "Could not undo");
        }),
    });
    navigate(href("/seo/ai"));
  };

  const engines = page.data.engines;
  const answered = engines.filter((e) => q.answers[e]).length;
  const naming = engines.filter((e) => q.answers[e]?.namedYou).length;
  return (
    <>
      <SeoHeader
        tab="ai"
        title={q.text}
        trail={[{ label: q.text }]}
        switcher={false}
        sub={q.pending ? "First answers in a few minutes." : `${naming} of ${answered} assistants name you.`}
        actions={
          can("track") && (
            <Button variant="ghost" onClick={() => void stop()}>
              Stop asking
            </Button>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        {engines.map((e) => (
          <AnswerCard key={e} engine={e} answer={q.answers[e]} />
        ))}
      </div>
      {source}
    </>
  );
}

/** One assistant's answer as a person reads it: whether it names you, the answer with your name picked out, and what it read. */
function AnswerCard({ engine, answer }: { engine: string; answer: Answer | null | undefined }) {
  const you = answer?.named.find((n) => n.isYou)?.name;
  const others = answer?.named.filter((n) => !n.isYou) ?? [];
  return (
    <Card className="flex min-w-0 flex-col gap-3">
      <h2 className="flex items-center justify-between gap-2 text-[14px] font-medium">
        <EngineName engine={engine} size={18} />
        {answer && (
          <Badge tone={answer.namedYou ? "good" : "bad"}>
            {answer.namedYou ? (answer.position ? `Named #${answer.position}` : "Named") : "Not named"}
          </Badge>
        )}
      </h2>
      {!answer ? (
        <p className="text-[13px] text-muted">No answer yet.</p>
      ) : (
        <>
          <p className="text-[13.5px] leading-relaxed">
            <Marked text={answer.excerpt} names={you ? [you] : []} />
          </p>
          {others.length > 0 && (
            <p className="text-[12.5px] text-muted">
              Also named: <span className="text-fg">{others.map((n) => n.name).join(", ")}</span>
            </p>
          )}
          <p className="mt-auto border-t border-line pt-3 text-[12.5px] text-muted">
            Cited: {answer.cites.length ? [...new Set(answer.cites)].join(", ") : "no sources"}
          </p>
        </>
      )}
    </Card>
  );
}

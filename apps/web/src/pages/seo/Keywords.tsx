// Keywords (/seo/keywords): where the website ranks on Google for each keyword, as one table: its searches, position,
// change and who's first. What else the results page showed (a map pack, an AI Overview and whether it cites you) is on
// the keyword's page only, so the list doesn't read like the Google Maps and AI answers sections; every row still
// carries it (hasMapPack, hasAiOverview, aiOverviewCitesYou), so a column for it is a <th> and a <td> away. A row opens the keyword's own page (/seo/keywords/<id>): its facts, its position over 90 days and
// Google's whole first page, with breadcrumbs back up.
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Check, ChevronRight, ExternalLink, Minus } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, LineChart, NewButton, cn, fmt } from "../../components/ui";
import { LoadError, useToast } from "../../components/Feedback";
import { messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { locationApi, seoApi, type SearchPage } from "./api";
import { AddKeywords } from "./AddDrawers";
import { Change, Source, rankTone, stack } from "./parts";
import { kindsOf, useAfterCheck, useReloadWhilePending } from "./checks";
import { SeoHeader, useSeo, useSeoHref } from "./Seo";

type Row = SearchPage["keywords"][number];

const source = (
  <Source>
    Google search from the business's own address, the top 100 results per keyword, through DataForSEO. Searches a month come from Google
    Ads data, refreshed monthly.
  </Source>
);

export default function Keywords() {
  const id = useParams()["*"];
  return id ? <KeywordPage key={id} id={id} /> : <KeywordList />;
}

function useSearchPage() {
  const { orgId, location } = useSeo();
  const page = useLoad(() => locationApi(orgId, location.id).results.search.get(), [orgId, location.id]);
  useReloadWhilePending(!!page.data?.keywords.some((k) => k.pending), page.reload);
  useAfterCheck(kindsOf.keywords, page.reload);
  return page;
}

function Position({ row }: { row: Row }) {
  if (row.pending) return <span className="text-[12.5px] text-muted">First check running</span>;
  if (row.position === null) return <span className="text-[12.5px] text-muted">Not in top 100</span>;
  return <Badge tone={rankTone(row.position)}>{row.position}</Badge>;
}

/** Positions moved since a month ago: up is good (a smaller number). Nothing to compare in the first month. */
function Moved({ row }: { row: Row }) {
  const none = <span className="text-muted">—</span>;
  if (row.pending || row.before === undefined) return none;
  if (row.before === null) return row.position === null ? none : <span className="text-[12.5px] text-good">New in top 100</span>;
  if (row.position === null) return <span className="text-[12.5px] text-bad">Dropped out</span>;
  const by = row.before - row.position;
  return by === 0 ? none : <span className={cn("num", by > 0 ? "text-good" : "text-bad")}>{by > 0 ? `+${by}` : by}</span>;
}

/** Yes or no, in words as well as the mark. */
function YesNo({ yes, label }: { yes: boolean; label?: string }) {
  return yes ? (
    <span className="inline-flex items-center gap-1 text-good">
      <Check size={14} aria-hidden />
      <span className={label ? "text-[12.5px]" : "sr-only"}>{label ?? "Yes"}</span>
    </span>
  ) : (
    <span className="inline-flex items-center text-subtle">
      <Minus size={14} aria-hidden />
      <span className="sr-only">No</span>
    </span>
  );
}

function AiOverview({ row }: { row: Row }) {
  if (!row.hasAiOverview) return <YesNo yes={false} />;
  return row.aiOverviewCitesYou ? <YesNo yes label="Cites you" /> : <span className="text-[12.5px] text-muted">Shown, not you</span>;
}

const firstName = (row: Row) => (row.first ? (row.first.isYou ? "You" : (row.first.name ?? row.first.domain)) : "—");

const th = "px-3 py-2 font-normal";

// ---------- All keywords ----------

function KeywordList() {
  const { orgId, can } = useSeo();
  const page = useSearchPage();
  const limits = useLoad(() => seoApi(orgId).limits.get(), [orgId]);
  const [adding, setAdding] = useState(false);
  const href = useSeoHref();
  const navigate = useNavigate();

  const data = page.data;
  const ready = data?.keywords.filter((k) => !k.pending).length ?? 0;
  const change = data && data.firstPageBefore !== null ? data.firstPage - data.firstPageBefore : null;
  return (
    <>
      <SeoHeader
        tab="keywords"
        suggestions="keywords"
        sub={
          data && ready ? (
            <>
              <span className="text-fg">
                {data.firstPage} of {ready} on Google's first page
              </span>
              {change !== null && (
                <>
                  {" · "}
                  <Change by={change} unit="more" none="no change in 30 days" />
                </>
              )}
            </>
          ) : (
            "Where your website ranks on Google."
          )
        }
        actions={can("track") && <NewButton onClick={() => setAdding(true)}>Add keywords</NewButton>}
      />
      <LoadError what="keywords">{page.error}</LoadError>
      {data && (
        <Card pad={false} className="overflow-x-auto">
          <table role="table" className={stack.table}>
            <thead role="rowgroup" className={stack.head}>
              <tr className="border-b border-line text-left text-[12.5px] text-muted">
                <th className={cn(th, "pl-4")}>Keyword</th>
                <th className={cn(th, "text-right")}>Searches / mo</th>
                <th className={th}>Position</th>
                <th className={cn(th, "text-right")}>30 days</th>
                <th className={th}>First on Google</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody role="rowgroup" className={stack.body}>
              {data.keywords.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted">
                    No keywords yet.
                  </td>
                </tr>
              )}
              {data.keywords.map((k) => {
                const to = href(`/seo/keywords/${k.id}`);
                return (
                  <tr
                    key={k.id}
                    role="row"
                    className={cn("cursor-pointer border-b border-line last:border-0 hover:bg-hover", stack.row)}
                    onClick={() => navigate(to)}
                  >
                    <td role="cell" className={cn(th, "pl-4 font-medium", stack.first)}>
                      <Link to={to} onClick={(e) => e.stopPropagation()} className="underline-offset-2 hover:underline">
                        {k.term}
                      </Link>
                    </td>
                    <td role="cell" data-label="Searches / mo" className={cn(th, "num text-right", stack.cell)}>
                      {k.monthlySearches === null ? "—" : fmt(k.monthlySearches)}
                    </td>
                    <td role="cell" data-label="Position" className={cn(th, stack.cell)}>
                      <Position row={k} />
                    </td>
                    <td role="cell" data-label="30 days" className={cn(th, "text-right", stack.cell)}>
                      <Moved row={k} />
                    </td>
                    <td
                      role="cell"
                      data-label="First on Google"
                      className={cn(th, "max-w-48 truncate text-muted", stack.cell, "max-sm:max-w-none")}
                    >
                      {firstName(k)}
                    </td>
                    <td role="cell" className={cn("pr-3", stack.hide)}>
                      <ChevronRight size={15} className="text-subtle" aria-hidden />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      {source}
      <AddKeywords
        on="organic"
        open={adding}
        onClose={() => setAdding(false)}
        tracked={data?.keywords.map((k) => k.term) ?? []}
        limit={limits.data?.keywords ?? null}
        onAdded={() => void page.reload()}
      />
    </>
  );
}

// ---------- One keyword ----------

function KeywordPage({ id }: { id: string }) {
  const { orgId, location, can } = useSeo();
  const page = useSearchPage();
  const toast = useToast();
  const href = useSeoHref();
  const navigate = useNavigate();
  const row = page.data?.keywords.find((k) => k.id === id);

  if (page.error) return <LoadError what="this keyword">{page.error}</LoadError>;
  if (!page.data) return null;
  if (!row)
    return (
      <>
        <SeoHeader tab="keywords" title="Keyword not found" trail={[{ label: "Not found" }]} sub="" switcher={false} />
        <Card>
          <p className="text-[13.5px]">This keyword isn't tracked on Google search for {location.name}.</p>
          <Link to={href("/seo/keywords")} className="mt-2 inline-block text-[13px] underline underline-offset-2">
            All keywords
          </Link>
        </Card>
      </>
    );

  // Stops it on Google search only (on Maps it carries on, if tracked there); Undo puts it back.
  const stop = async () => {
    const here = locationApi(orgId, location.id);
    const r = await here.keywords({ keywordId: row.id }).delete({ query: { from: "organic" } });
    if (r.error) return toast.error(messageOf(r.error), "Could not stop tracking");
    toast.success(`Stopped tracking “${row.term}” on Google search`, "Its history is kept.", {
      label: "Undo",
      run: () =>
        void here.keywords.post({ terms: [row.term], maps: false, organic: true }).then((u) => {
          if (u.error) toast.error(messageOf(u.error), "Could not undo");
        }),
    });
    navigate(href("/seo/keywords"));
  };

  const known = row.history.values.filter((v): v is number => v !== null);
  return (
    <>
      <SeoHeader
        tab="keywords"
        title={row.term}
        trail={[{ label: row.term }]}
        switcher={false}
        sub={row.monthlySearches === null ? "Searches a month not known yet." : `${fmt(row.monthlySearches)} searches a month.`}
        actions={
          can("track") && (
            <Button variant="ghost" onClick={() => void stop()}>
              Stop tracking
            </Button>
          )
        }
      />
      <div className="space-y-6">
        <Card className="grid grid-cols-2 gap-5 sm:grid-cols-5">
          <Fact label="Your position">
            <Position row={row} />
          </Fact>
          <Fact label="30 days">
            <Moved row={row} />
          </Fact>
          <Fact label="Map pack">{row.pending ? "—" : <YesNo yes={row.hasMapPack} label="Shown" />}</Fact>
          <Fact label="AI Overview">{row.pending ? "—" : <AiOverview row={row} />}</Fact>
          <Fact label="Your page">
            {row.url ? (
              <a
                href={row.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1 text-[13px] hover:underline"
              >
                <span className="truncate">{row.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                <ExternalLink size={11} className="shrink-0" aria-hidden />
              </a>
            ) : (
              <span className="text-[13px] text-muted">Not ranking</span>
            )}
          </Fact>
        </Card>

        <Card>
          <h2 className="mb-2 text-[14px] font-medium">Position, 90 days</h2>
          {known.length < 2 ? (
            <p className="text-[13px] text-muted">Shows after two weeks of checks. A gap means not in the top 100.</p>
          ) : (
            <>
              <LineChart
                height={200}
                invert
                yMax={Math.max(10, ...known) + 1}
                labels={row.history.labels}
                series={[{ name: "Your position", color: "var(--accent)", values: row.history.values }]}
              />
              <p className="mt-1 text-[12.5px] text-muted">Higher is better. A gap means not in the top 100 that week.</p>
            </>
          )}
        </Card>

        <Card pad={false}>
          <h2 className="px-4 pt-4 text-[14px] font-medium">Google's first page</h2>
          <FirstPage row={row} />
        </Card>
      </div>
      {source}
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[12.5px] text-muted">{label}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function FirstPage({ row }: { row: Row }) {
  if (row.page.length === 0) return <p className="px-4 pt-1 pb-4 text-[13px] text-muted">The first page comes with the first check.</p>;
  return (
    <ol className="divide-y divide-line px-4 pb-2">
      {row.page.map((p) => (
        <li key={p.position} className={cn("flex items-start gap-3 py-2.5", p.isYou && "font-medium")}>
          <span className="num w-6 shrink-0 text-right text-muted">{p.position}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate">{p.isYou ? `You: ${p.title}` : p.title || p.domain}</p>
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12.5px] font-normal text-muted hover:text-fg"
            >
              {p.name ?? p.domain}
              <ExternalLink size={11} aria-hidden />
            </a>
          </div>
          {p.kind === "directory" && <Badge>Directory</Badge>}
        </li>
      ))}
    </ol>
  );
}

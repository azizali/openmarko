// Keywords (/seo/keywords): where the website ranks on Google for each keyword. A headline (how many are on the
// first page, over 90 days), then one row per keyword that opens to Google's whole first page.
import { Fragment, useState, type ReactNode } from "react";
import { ChevronRight, ExternalLink, Plus } from "lucide-react";
import { Badge, Button, Card, cn, fmt } from "../../components/ui";
import { LoadError, useToast } from "../../components/Feedback";
import { messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { locationApi, seoApi, type SearchPage } from "./api";
import { AddKeywords } from "./AddDrawers";
import { Headline, Source, rankTone } from "./parts";
import { kindsOf, useAfterCheck, useReloadWhilePending } from "./checks";
import { SeoHeader, useSeo } from "./Seo";

type Row = SearchPage["keywords"][number];

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

function Markers({ row }: { row: Row }) {
  const marks: ReactNode[] = [];
  if (row.hasMapPack) marks.push("Map pack");
  if (row.hasAiOverview) marks.push(row.aiOverviewCitesYou ? "AI Overview cites you" : "AI Overview");
  if (!marks.length) return null;
  return <span className="block text-[12px] text-muted">{marks.join(" · ")}</span>;
}

function FirstPage({ row, onStop }: { row: Row; onStop?: () => void }) {
  return (
    <div className="px-4 pt-1 pb-4">
      {row.page.length === 0 ? (
        <p className="text-[13px] text-muted">The first page comes with the first check.</p>
      ) : (
        <ol className="divide-y divide-line">
          {row.page.map((p) => (
            <li key={p.position} className={cn("flex items-start gap-3 py-2", p.isYou && "font-medium")}>
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
      )}
      {onStop && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={onStop}>
          Stop tracking
        </Button>
      )}
    </div>
  );
}

const th = "px-3 py-2 font-normal";

export default function Keywords() {
  const { orgId, location, can } = useSeo();
  const page = useLoad(() => locationApi(orgId, location.id).results.search.get(), [orgId, location.id]);
  const limits = useLoad(() => seoApi(orgId).limits.get(), [orgId]);
  useReloadWhilePending(!!page.data?.keywords.some((k) => k.pending), page.reload);
  useAfterCheck(kindsOf.keywords, page.reload);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const toast = useToast();

  const stop = async (row: Row) => {
    if (!confirm(`Stop tracking “${row.term}”? Its history is kept.`)) return;
    const r = await locationApi(orgId, location.id).keywords({ keywordId: row.id }).delete();
    if (r.error) return toast.error(messageOf(r.error), "Could not stop tracking");
    toast.success(`Stopped tracking “${row.term}”`);
    void page.reload();
  };

  const data = page.data;
  const ready = data?.keywords.filter((k) => !k.pending).length ?? 0;
  return (
    <>
      <SeoHeader
        tab="keywords"
        sub="Where your website ranks on Google for each keyword."
        actions={
          can("track") && (
            <Button icon={<Plus size={14} />} onClick={() => setAdding(true)}>
              Add keywords
            </Button>
          )
        }
      />
      <LoadError what="keywords">{page.error}</LoadError>
      {data && (
        <>
          <Headline
            label="On Google's first page"
            value={data.firstPage}
            of={ready}
            change={data.firstPageBefore === null ? null : data.firstPage - data.firstPageBefore}
            unit="more"
            history={data.history}
          />
          <Card pad={false} className="mt-4 overflow-x-auto">
            <table className="w-full min-w-160 text-[13.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[12.5px] text-muted">
                  <th className={cn(th, "pl-4")}>Keyword</th>
                  <th className={cn(th, "text-right")}>Searches / mo</th>
                  <th className={th}>Your position</th>
                  <th className={cn(th, "text-right")}>30 days</th>
                  <th className={th}>First on Google</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {data.keywords.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted">
                      No keywords yet.
                    </td>
                  </tr>
                )}
                {data.keywords.map((k) => {
                  const isOpen = open === k.id;
                  return (
                    <Fragment key={k.id}>
                      <tr
                        className={cn("cursor-pointer border-b border-line last:border-0 hover:bg-hover", isOpen && "bg-hover")}
                        onClick={() => setOpen(isOpen ? null : k.id)}
                      >
                        <td className={cn(th, "pl-4")}>
                          <button type="button" aria-expanded={isOpen} className="text-left font-medium">
                            {k.term}
                          </button>
                          <Markers row={k} />
                        </td>
                        <td className={cn(th, "num text-right")}>{k.monthlySearches === null ? "—" : fmt(k.monthlySearches)}</td>
                        <td className={th}>
                          <Position row={k} />
                        </td>
                        <td className={cn(th, "text-right")}>
                          <Moved row={k} />
                        </td>
                        <td className={cn(th, "max-w-48 truncate text-muted")}>
                          {k.first ? (k.first.isYou ? "You" : (k.first.name ?? k.first.domain)) : "—"}
                        </td>
                        <td className="pr-3">
                          <ChevronRight size={15} className={cn("text-subtle transition-transform", isOpen && "rotate-90")} aria-hidden />
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-line last:border-0">
                          <td colSpan={6}>
                            <FirstPage row={k} onStop={can("track") ? () => void stop(k) : undefined} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
      <Source>
        Google search from the business's own address, the top 100 results per keyword, through DataForSEO. Searches a month come from
        Google Ads data, refreshed monthly.
      </Source>
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

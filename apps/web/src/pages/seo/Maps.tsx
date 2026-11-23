// Google Maps ranking (/seo/maps): one table of every Maps keyword with how much of the area sees it in the top 3 (its
// grid beside the share, and the change in 30 days), average rank and who's #1, and a totals row for all of them together. Deeper pages, read from the rest of the path: a keyword
// (/seo/maps/<keywordId>, MapsKeyword.tsx) and a business (/seo/maps/places/<placeId>, Place.tsx).
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ChevronRight } from "lucide-react";
import { Card, NewButton, cn } from "../../components/ui";
import { LoadError } from "../../components/Feedback";
import { useLoad } from "../../lib/useLoad";
import { locationApi, seoApi, type MapsSummary } from "./api";
import { AddKeywords } from "./AddDrawers";
import { GridLegend, GridThumb, stack } from "./parts";
import { kindsOf, useAfterCheck, useReloadWhilePending } from "./checks";
import { SeoHeader, useSeo, useSeoHref } from "./Seo";
import { miles } from "./distance";
import MapsKeyword, { MapsSource } from "./MapsKeyword";
import Place from "./Place";

export default function Maps() {
  const rest = useParams()["*"] ?? "";
  const [first, second] = rest.split("/");
  if (first === "places" && second) return <Place key={second} placeId={second} />;
  if (first) return <MapsKeyword key={first} keywordId={first} />;
  return <MapsList />;
}

const th = stack.pad;

function MapsList() {
  const { orgId, location, can } = useSeo();
  const summary = useLoad(() => locationApi(orgId, location.id).results.maps.get(), [orgId, location.id]);
  const limits = useLoad(() => seoApi(orgId).limits.get(), [orgId]);
  const [adding, setAdding] = useState(false);
  const href = useSeoHref();
  const navigate = useNavigate();
  useReloadWhilePending(!!summary.data?.keywords.some((k) => k.pending), summary.reload);
  useAfterCheck(kindsOf.maps, summary.reload);
  const data = summary.data;

  return (
    <>
      <SeoHeader
        tab="maps"
        sub={`Your rank from ${location.gridSize * location.gridSize} spots within ${miles(location.gridRadiusM)}.`}
        suggestions="maps"
        actions={can("track") && <NewButton onClick={() => setAdding(true)}>Add keywords</NewButton>}
      />
      {summary.error ? (
        <LoadError what="your map rankings">{summary.error}</LoadError>
      ) : (
        data && (
          <>
            <Card pad={false} className="overflow-x-auto">
              <table role="table" className={stack.table}>
                <thead role="rowgroup" className={stack.head}>
                  <tr className="border-b border-line text-left text-[12.5px] text-muted">
                    <th className={cn(th, "pl-4")}>Keyword</th>
                    <th className={th}>Top 3 in your area</th>
                    <th className={cn(th, "text-right")}>Avg rank</th>
                    <th className={th}>#1 here</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody role="rowgroup" className={stack.body}>
                  {data.keywords.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted">
                        No keywords yet.
                      </td>
                    </tr>
                  )}
                  {data.keywords.map((k) => {
                    const to = href(`/seo/maps/${k.id}`);
                    if (k.pending)
                      return (
                        <tr key={k.id} role="row" className={cn("border-b border-line last:border-0", stack.row)}>
                          <td role="cell" className={cn(th, "pl-4 font-medium", stack.first)}>
                            {k.term}
                          </td>
                          <td role="cell" colSpan={4} className={cn(th, "text-[12.5px] text-muted", stack.first)}>
                            First scan running…
                          </td>
                        </tr>
                      );
                    const spots = k.size * k.size;
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
                        {/* One number for the area (the overview's "31% of your area"), its grid beside it; the count of spots is in the title. */}
                        <td role="cell" data-label="Top 3 in your area" className={cn(th, stack.cell)}>
                          <span className="inline-flex items-center gap-3" title={`Top 3 at ${k.top3} of ${spots} spots`}>
                            <GridThumb size={k.size} ranks={k.grid} />
                            <span className="num">
                              {share(k.top3, spots)}%
                              {k.top3Before !== null && <Diff by={share(k.top3, spots) - share(k.top3Before, spots)} />}
                            </span>
                          </span>
                        </td>
                        <td role="cell" data-label="Avg rank" className={cn(th, "num text-right", stack.cell)}>
                          {k.avg.toFixed(1)}
                        </td>
                        <td role="cell" data-label="#1 here" className={cn(th, "max-w-48 truncate", stack.cell, "max-sm:max-w-none")}>
                          {k.leader ? <span className="text-muted">{k.leader.name}</span> : <span className="text-good">You</span>}
                        </td>
                        <td role="cell" className={cn("pr-3", stack.hide)}>
                          <ChevronRight size={15} className="text-subtle" aria-hidden />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <Totals data={data} />
              </table>
            </Card>
            <div className="mt-3">
              <GridLegend />
            </div>
          </>
        )
      )}
      <MapsSource />
      <AddKeywords
        on="maps"
        open={adding}
        onClose={() => setAdding(false)}
        tracked={(data?.keywords ?? []).map((k) => k.term)}
        limit={limits.data?.keywords ?? null}
        onAdded={() => void summary.reload()}
      />
    </>
  );
}

/** A share of the area in the top 3, as a whole percentage. */
const share = (top3: number, spots: number) => (spots ? Math.round((top3 / spots) * 100) : 0);

/** Points of the area gained (+) or lost since a month ago, beside the share; nothing when unchanged. */
function Diff({ by }: { by: number }) {
  if (by === 0) return null;
  return (
    <span className={cn("num ml-1.5 text-[12px] font-normal", by > 0 ? "text-good" : "text-bad")}>
      {by > 0 ? `+${by}` : `−${Math.abs(by)}`}
      <span className="sr-only"> points in 30 days</span>
    </span>
  );
}

/** All keywords together, as the table's last row. */
function Totals({ data }: { data: MapsSummary }) {
  const { totals, keywords } = data;
  const ready = keywords.filter((k) => !k.pending).length;
  if (!ready) return null;

  return (
    <tfoot role="rowgroup" className={stack.body}>
      <tr role="row" className={cn(stack.total, stack.row)}>
        <td role="cell" className={cn(th, "pl-4", stack.first)}>
          All {ready} keywords
        </td>
        <td role="cell" data-label="Top 3 in your area" className={cn(th, "num", stack.cell)}>
          {share(totals.top3, totals.spots)}%
          {totals.top3Before !== null && <Diff by={share(totals.top3, totals.spots) - share(totals.top3Before, totals.spots)} />}
        </td>
        <td role="cell" data-label="Avg rank" className={cn(th, "num text-right", stack.cell)}>
          {totals.avg === null ? "—" : totals.avg.toFixed(1)}
          {totals.avgBefore !== null && <span className="block text-[12px] font-normal text-muted">was {totals.avgBefore.toFixed(1)}</span>}
        </td>
        <td role="cell" data-label="#1 here" className={cn(th, stack.cell)}>
          <span className="font-normal">
            You lead {totals.leading} of {ready}
          </span>
        </td>
        <td role="cell" className={stack.hide} />
      </tr>
    </tfoot>
  );
}

// Competitors (/seo/competitors): who beats the business, per channel (Google Maps, Google search, AI answers) and
// per keyword or question. One row per competitor; it opens to every keyword with their result beside yours, the
// ones they win first. Found for you; one can be added by hand or hidden.
import { useState } from "react";
import { useSearchParams } from "react-router";
import { ChevronRight, Plus } from "lucide-react";
import { Badge, Button, Card, Segmented, cn } from "../../components/ui";
import { LoadError, useToast } from "../../components/Feedback";
import { messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { locationApi, type Channel, type CompetitorsPage } from "./api";
import { AddCompetitor } from "./AddDrawers";
import { Source } from "./parts";
import { kindsOf, useAfterCheck } from "./checks";
import { SeoHeader, useSeo } from "./Seo";

type Row = CompetitorsPage["rows"][number];
type Cell = Row["cells"][number];

const channelNames: Record<Channel, string> = { maps: "Google Maps", google: "Google search", ai: "AI answers" };
const isChannel = (v: string | null): v is Channel => v === "maps" || v === "google" || v === "ai";

/** Is their result better? Lower is better on Google; higher everywhere else. */
const ahead = (channel: Channel, c: Cell) =>
  c.theirs !== null && (channel === "google" ? c.yours === null || c.theirs < c.yours : c.theirs > (c.yours ?? 0));

const shown = (channel: Channel, v: number | null) => (v === null ? (channel === "google" ? "Not on page one" : "—") : String(v));

function Columns({ channel, row, labels }: { channel: Channel; row: Row; labels: Map<string, string> }) {
  const cells = row.cells.toSorted((a, b) => Number(ahead(channel, b)) - Number(ahead(channel, a)));
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-left text-[12px] text-muted">
          <th className="py-1.5 font-normal">{channel === "ai" ? "Question" : "Keyword"}</th>
          <th className="py-1.5 text-right font-normal">Them</th>
          <th className="py-1.5 text-right font-normal">You</th>
        </tr>
      </thead>
      <tbody>
        {cells.map((c) => {
          const wins = ahead(channel, c);
          return (
            <tr key={c.id} className="border-t border-line">
              <td className={cn("py-1.5 pr-3", wins && "text-bad")}>{labels.get(c.id)}</td>
              <td className={cn("num py-1.5 text-right whitespace-nowrap", wins && "font-medium text-bad")}>{shown(channel, c.theirs)}</td>
              <td className="num py-1.5 pl-3 text-right whitespace-nowrap">{shown(channel, c.yours)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** A competitor found in results has a place id; ones known only by a domain or a name can't be hidden. */
const hideable = (row: Row) => row.kind === "business" && !row.id.startsWith("domain:") && !row.id.startsWith("name:");

export default function Competitors() {
  const { orgId, location, can } = useSeo();
  const [params, setParams] = useSearchParams();
  const asked = params.get("channel");
  const channel: Channel = isChannel(asked) ? asked : "maps";
  const page = useLoad(
    () => locationApi(orgId, location.id).results.competitors.get({ query: { channel } }),
    [orgId, location.id, channel],
  );
  useAfterCheck(kindsOf.competitors, page.reload);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const toast = useToast();

  const pick = (c: Channel) =>
    setParams(
      (p) => {
        p.set("channel", c);
        return p;
      },
      { replace: true },
    );
  const hide = async (row: Row) => {
    const r = await locationApi(orgId, location.id).competitors.overrides.post({ action: "hidden", placeId: row.id });
    if (r.error) return toast.error(messageOf(r.error), "Could not hide");
    toast.success(`Hid ${row.name}`);
    void page.reload();
  };
  const unset = async (overrideId: string, done: string) => {
    const r = await locationApi(orgId, location.id).competitors.overrides({ overrideId }).delete();
    if (r.error) return toast.error(messageOf(r.error), "Could not change it");
    toast.success(done);
    void page.reload();
  };

  const data = page.data;
  const spots = location.gridSize * location.gridSize;
  const unit = {
    maps: `Spots in the top 3, out of ${spots}`,
    google: "Position on the first page",
    ai: `Assistants that name them, out of ${location.engines.length}`,
  }[channel];
  const noun = channel === "ai" ? "questions" : "keywords";
  const labels = new Map((data?.columns ?? []).map((c) => [c.id, c.label]));

  return (
    <>
      <SeoHeader
        tab="competitors"
        sub="Who beats you, keyword by keyword. Found for you."
        actions={
          can("track") && (
            <Button icon={<Plus size={14} />} onClick={() => setAdding(true)}>
              Add competitor
            </Button>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<Channel>
          label="Where people searched"
          value={channel}
          onChange={pick}
          options={(["maps", "google", "ai"] as const).map((id) => ({ id, label: channelNames[id] }))}
        />
        <span className="text-[12.5px] text-muted">{unit}</span>
      </div>
      <LoadError what="competitors">{page.error}</LoadError>
      {data && (
        <>
          {data.columns.length === 0 ? (
            <Card className="mt-4 text-center">
              <p className="text-[14px] font-medium">Competitors appear after the first check.</p>
              <p className="mt-1 text-[13px] text-muted">Everyone who shows up for your {noun} is compared with you.</p>
            </Card>
          ) : (
            <Card pad={false} className="mt-4">
              <ul className="divide-y divide-line">
                {data.rows.length === 0 && (
                  <li className="px-4 py-6 text-center text-[13.5px] text-muted">Nobody else shows up here yet.</li>
                )}
                {data.rows.map((row) => {
                  const isOpen = open === row.id;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpen(isOpen ? null : row.id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-hover"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-[14px] font-medium">{row.name}</span>
                            {row.kind === "directory" && <Badge>Directory</Badge>}
                            {row.addedByYou && <Badge>Added by you</Badge>}
                          </span>
                          <span className={cn("block text-[12.5px]", row.ahead ? "text-bad" : "text-muted")}>
                            Ahead of you on {row.ahead} of {data.columns.length} {noun}
                          </span>
                        </span>
                        <ChevronRight
                          size={15}
                          className={cn("shrink-0 text-subtle transition-transform", isOpen && "rotate-90")}
                          aria-hidden
                        />
                      </button>
                      {isOpen && (
                        <div className="overflow-x-auto px-4 pb-4">
                          <Columns channel={channel} row={row} labels={labels} />
                          {can("track") && hideable(row) && !row.addedByYou && (
                            <Button variant="ghost" size="sm" className="mt-2" onClick={() => void hide(row)}>
                              Hide
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
          <Exceptions
            title="Added by you"
            items={data.added}
            action="Remove"
            canChange={can("track")}
            onChange={(o) => void unset(o.overrideId, `Removed ${o.name}`)}
          />
          <Exceptions
            title="Hidden"
            items={data.hidden}
            action="Unhide"
            canChange={can("track")}
            onChange={(o) => void unset(o.overrideId, `${o.name} is back`)}
          />
        </>
      )}
      <Source>
        No requests of its own: everyone who shows up in the Maps, Google search and AI answers already collected for your keywords and
        questions.
      </Source>
      <AddCompetitor
        open={adding}
        onClose={() => setAdding(false)}
        known={data?.rows.map((r) => r.name) ?? []}
        onAdded={() => void page.reload()}
      />
    </>
  );
}

type Exception = CompetitorsPage["added"][number];

function Exceptions({
  title,
  items,
  action,
  canChange,
  onChange,
}: {
  title: string;
  items: Exception[];
  action: string;
  canChange: boolean;
  onChange: (o: Exception) => void;
}) {
  if (!items.length) return null;
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-[13px] font-medium text-muted">{title}</h2>
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        {items.map((o) => (
          <li key={o.overrideId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13.5px]">
            <span className="truncate">{o.name}</span>
            {canChange && (
              <Button variant="ghost" size="sm" onClick={() => onChange(o)}>
                {action}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

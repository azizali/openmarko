// Competitors (/seo/competitors): who beats the business. One table per channel (Google Maps, Google search, AI
// answers, picked above it), a row per competitor with how often they're ahead. A competitor opens its own page
// (/seo/competitors/<id>): every channel at once, their result beside yours for every keyword or question, each one
// linking to that keyword's page. Found for you; one can be added by hand or hidden.
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowUp, ChevronRight, Plus } from "lucide-react";
import { Badge, Button, Card, Segmented, cn } from "../../components/ui";
import { LoadError, useToast } from "../../components/Feedback";
import { messageOf } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { locationApi, type Channel, type CompetitorsPage } from "./api";
import { AddCompetitor } from "./AddDrawers";
import { Source, stack } from "./parts";
import { kindsOf, useAfterCheck } from "./checks";
import { SeoHeader, useSeo, useSeoHref } from "./Seo";

type Row = CompetitorsPage["rows"][number];
type Cell = Row["cells"][number];

const channels = ["maps", "google", "ai"] as const;
const channelNames: Record<Channel, string> = { maps: "Google Maps", google: "Google search", ai: "AI answers" };
const isChannel = (v: string | null): v is Channel => v === "maps" || v === "google" || v === "ai";
const nounOf = (channel: Channel) => (channel === "ai" ? "questions" : "keywords");

/** Is their result better? Lower is better on Google; higher everywhere else. */
const ahead = (channel: Channel, c: Cell) =>
  c.theirs !== null && (channel === "google" ? c.yours === null || c.theirs < c.yours : c.theirs > (c.yours ?? 0));

const shown = (channel: Channel, v: number | null) => (v === null ? (channel === "google" ? "Not on page one" : "—") : String(v));

/** A competitor found in results has a place id; ones known only by a domain or a name can't be hidden. */
const hideable = (row: Row) => row.kind === "business" && !row.id.startsWith("domain:") && !row.id.startsWith("name:");

const source = (
  <Source>
    No requests of its own: everyone who shows up in the Maps, Google search and AI answers already collected for your keywords and
    questions.
  </Source>
);

export default function Competitors() {
  const id = useParams()["*"];
  // The router hands the rest of the path back already decoded.
  return id ? <CompetitorPage key={id} id={id} /> : <CompetitorList />;
}

function useCompetitors(channel: Channel) {
  const { orgId, location } = useSeo();
  const page = useLoad(
    () => locationApi(orgId, location.id).results.competitors.get({ query: { channel } }),
    [orgId, location.id, channel],
  );
  useAfterCheck(kindsOf.competitors, page.reload);
  return page;
}

const th = "px-3 py-2 font-normal";

// ---------- Everyone ----------

function CompetitorList() {
  const { orgId, location, can } = useSeo();
  const [params, setParams] = useSearchParams();
  const asked = params.get("channel");
  const channel: Channel = isChannel(asked) ? asked : "maps";
  const page = useCompetitors(channel);
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const href = useSeoHref();
  const navigate = useNavigate();

  const pick = (c: Channel) =>
    setParams(
      (p) => {
        p.set("channel", c);
        return p;
      },
      { replace: true },
    );
  const unset = async (overrideId: string, done: string) => {
    const r = await locationApi(orgId, location.id).competitors.overrides({ overrideId }).delete();
    if (r.error) return toast.error(messageOf(r.error), "Could not change it");
    toast.success(done);
    void page.reload();
  };

  const data = page.data;
  const spots = location.gridSize * location.gridSize;
  const unit = {
    maps: `top-3 spots, out of ${spots}`,
    google: "position on the first page",
    ai: `assistants that name them, out of ${location.engines.length}`,
  }[channel];
  const noun = nounOf(channel);
  const total = data?.columns.length ?? 0;
  const beating = data?.rows.filter((r) => r.ahead > 0).length ?? 0;

  return (
    <>
      <SeoHeader
        tab="competitors"
        sub={data && total ? `${beating} ahead of you on at least one of ${total} ${noun}.` : "Who beats you, keyword by keyword."}
        actions={
          can("track") && (
            <Button icon={<Plus size={14} />} onClick={() => setAdding(true)}>
              Add competitor
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented<Channel>
          label="Where people searched"
          value={channel}
          onChange={pick}
          options={channels.map((id) => ({ id, label: channelNames[id] }))}
        />
        <span className="text-[12.5px] text-muted">Compared by {unit}</span>
      </div>
      <LoadError what="competitors">{page.error}</LoadError>
      {data && (
        <>
          {data.columns.length === 0 ? (
            <Card className="text-center">
              <p className="text-[14px] font-medium">Competitors appear after the first check.</p>
              <p className="mt-1 text-[13px] text-muted">Everyone who shows up for your {noun} is compared with you.</p>
            </Card>
          ) : (
            <Card pad={false} className="overflow-x-auto">
              <table role="table" className={stack.table}>
                <thead role="rowgroup" className={stack.head}>
                  <tr className="border-b border-line text-left text-[12.5px] text-muted">
                    <th className={cn(th, "pl-4")}>Competitor</th>
                    <th className={th}>Ahead of you on</th>
                    <th className={th}>Where they beat you most</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody role="rowgroup" className={stack.body}>
                  {data.rows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-muted">
                        Nobody else shows up here yet.
                      </td>
                    </tr>
                  )}
                  {data.rows.map((row) => {
                    const to = href(`/seo/competitors/${encodeURIComponent(row.id)}?channel=${channel}`);
                    const labels = new Map(data.columns.map((c) => [c.id, c.label]));
                    const wins = row.cells.filter((c) => ahead(channel, c)).map((c) => labels.get(c.id));
                    return (
                      <tr
                        key={row.id}
                        role="row"
                        className={cn("cursor-pointer border-b border-line last:border-0 hover:bg-hover", stack.row)}
                        onClick={() => navigate(to)}
                      >
                        <td role="cell" className={cn(th, "pl-4", stack.first)}>
                          <span className="flex flex-wrap items-center gap-1.5">
                            <Link to={to} onClick={(e) => e.stopPropagation()} className="font-medium underline-offset-2 hover:underline">
                              {row.name}
                            </Link>
                            {row.kind === "directory" && <Badge>Directory</Badge>}
                            {row.addedByYou && <Badge>Added by you</Badge>}
                          </span>
                          {row.domain && <span className="block text-[12px] text-muted">{row.domain}</span>}
                        </td>
                        <td role="cell" data-label="Ahead of you on" className={cn(th, stack.cell)}>
                          <span className="flex items-center gap-2">
                            <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-hover sm:block" aria-hidden>
                              <span className="block h-full rounded-full bg-accent" style={{ width: `${(row.ahead / total) * 100}%` }} />
                            </span>
                            <span className={cn("num whitespace-nowrap", row.ahead ? "text-bad" : "text-muted")}>
                              {row.ahead} of {total}
                            </span>
                          </span>
                        </td>
                        <td
                          role="cell"
                          data-label="Where they beat you"
                          className={cn(th, "max-w-64 truncate text-muted", stack.cell, "max-sm:max-w-none")}
                        >
                          {wins.length ? wins.slice(0, 2).join(", ") + (wins.length > 2 ? ` +${wins.length - 2}` : "") : "—"}
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
      {source}
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

// ---------- One competitor ----------

function CompetitorPage({ id }: { id: string }) {
  const { orgId, location, can } = useSeo();
  const toast = useToast();
  const href = useSeoHref();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const from = params.get("channel");
  const back = href(`/seo/competitors${isChannel(from) ? `?channel=${from}` : ""}`);
  const maps = useCompetitors("maps");
  const google = useCompetitors("google");
  const ai = useCompetitors("ai");
  const pages = { maps, google, ai };

  const error = maps.error ?? google.error ?? ai.error;
  if (error) return <LoadError what="this competitor">{error}</LoadError>;
  if (!maps.data || !google.data || !ai.data) return null;

  const found = channels
    .map((c) => ({ channel: c, data: pages[c].data!, row: pages[c].data!.rows.find((r) => r.id === id) }))
    .filter((x): x is { channel: Channel; data: CompetitorsPage; row: Row } => !!x.row);
  const any = found[0]?.row;
  const added = maps.data.added.find((a) => a.placeId === id);
  const isPlace = !id.startsWith("domain:") && !id.startsWith("name:");

  if (!any)
    return (
      <>
        <SeoHeader tab="competitors" title="Competitor not found" trail={[{ label: "Not found" }]} sub="" switcher={false} />
        <Card>
          <p className="text-[13.5px]">They don't show up against {location.name} now, or they're hidden.</p>
          <Link to={back} className="mt-2 inline-block text-[13px] underline underline-offset-2">
            All competitors
          </Link>
        </Card>
      </>
    );

  const hide = async () => {
    const r = await locationApi(orgId, location.id).competitors.overrides.post({ action: "hidden", placeId: id });
    if (r.error) return toast.error(messageOf(r.error), "Could not hide");
    toast.success(`Hid ${any.name}`, "Unhide it from the list of competitors.");
    navigate(back);
  };
  const remove = async (overrideId: string) => {
    const r = await locationApi(orgId, location.id).competitors.overrides({ overrideId }).delete();
    if (r.error) return toast.error(messageOf(r.error), "Could not remove");
    toast.success(`Removed ${any.name}`);
    navigate(back);
  };

  const sub = found
    .map((f) => `ahead on ${f.row.ahead} of ${f.data.columns.length} ${channelNames[f.channel]} ${nounOf(f.channel)}`)
    .join(" · ");
  return (
    <>
      <SeoHeader
        tab="competitors"
        title={any.name}
        trail={[{ label: any.name }]}
        switcher={false}
        sub={sub.charAt(0).toUpperCase() + sub.slice(1) + "."}
        actions={
          <>
            {isPlace && any.kind === "business" && (
              <Link to={href(`/seo/maps/places/${id}`)} className="text-[13px] text-muted underline-offset-2 hover:text-fg hover:underline">
                Their profile
              </Link>
            )}
            {can("track") && added && (
              <Button variant="ghost" onClick={() => void remove(added.overrideId)}>
                Remove
              </Button>
            )}
            {can("track") && !added && hideable(any) && (
              <Button variant="ghost" onClick={() => void hide()}>
                Hide
              </Button>
            )}
          </>
        }
      />
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px]">
        {any.kind === "directory" && <Badge>Directory</Badge>}
        {any.addedByYou && <Badge>Added by you</Badge>}
        {any.domain && <span className="text-muted">{any.domain}</span>}
      </div>
      <div className="space-y-6">
        {channels.map((c) => {
          const f = found.find((x) => x.channel === c);
          return (
            <Card key={c} pad={false}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4">
                <h2 className="text-[14px] font-medium">{channelNames[c]}</h2>
                {f && (
                  <span className={cn("text-[12.5px]", f.row.ahead ? "text-bad" : "text-muted")}>
                    Ahead on {f.row.ahead} of {f.data.columns.length} {nounOf(c)}
                  </span>
                )}
              </div>
              {f ? (
                <Columns channel={c} row={f.row} data={f.data} placeId={isPlace ? id : null} />
              ) : (
                <p className="px-4 pt-1 pb-4 text-[13px] text-muted">Doesn't show up for your {nounOf(c)} here.</p>
              )}
            </Card>
          );
        })}
      </div>
      {source}
    </>
  );
}

const unitOf: Record<Channel, string> = { maps: "Top-3 spots", google: "Position", ai: "Assistants naming" };

/** Their result beside yours for every keyword or question, the ones they win first. Each opens that keyword's page. */
function Columns({ channel, row, data, placeId }: { channel: Channel; row: Row; data: CompetitorsPage; placeId: string | null }) {
  const href = useSeoHref();
  const labels = new Map(data.columns.map((c) => [c.id, c.label]));
  const cells = row.cells.toSorted((a, b) => Number(ahead(channel, b)) - Number(ahead(channel, a)));
  const link = (cellId: string): string =>
    channel === "maps"
      ? href(`/seo/maps/${cellId}${placeId ? `?who=${placeId}` : ""}`)
      : channel === "google"
        ? href(`/seo/keywords/${cellId}`)
        : href(`/seo/ai/${cellId}`);
  return (
    <div className="overflow-x-auto px-4 pb-3">
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="text-left text-[12px] text-muted">
            <th className="py-2 font-normal">{channel === "ai" ? "Question" : "Keyword"}</th>
            <th className="py-2 text-right font-normal">Them · {unitOf[channel]}</th>
            <th className="py-2 pl-3 text-right font-normal">You</th>
          </tr>
        </thead>
        <tbody>
          {cells.map((c) => {
            const wins = ahead(channel, c);
            return (
              <tr key={c.id} className="border-t border-line">
                <td className={cn("py-2 pr-3", wins && "text-bad")}>
                  <Link to={link(c.id)} className="underline-offset-2 hover:underline">
                    {wins && <ArrowUp size={12} className="mr-1 inline align-[-1px]" aria-hidden />}
                    {labels.get(c.id)}
                    {wins && <span className="sr-only"> (they're ahead)</span>}
                  </Link>
                </td>
                <Num strong={wins}>{shown(channel, c.theirs)}</Num>
                <td className="num py-2 pl-3 text-right whitespace-nowrap">{shown(channel, c.yours)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Num({ strong, children }: { strong: boolean; children: ReactNode }) {
  return <td className={cn("num py-2 text-right whitespace-nowrap", strong && "font-medium text-bad")}>{children}</td>;
}

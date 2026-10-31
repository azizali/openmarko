import type { ReactNode } from "react";
import { ExternalLink, MapPin, Globe } from "lucide-react";
import { Button, Card, cn } from "./ui";
import { locations } from "../data/mock";
import { shortLocation, websites, websiteFor, type Website } from "../data/org";
import { setScope, useScope } from "../lib/scope";
import { useSetup } from "../lib/setup";

/** A domain as a link that opens the site in a new tab. */
export function ExternalUrl({ domain, path = "", className }: { domain: string; path?: string; className?: string }) {
  const url = `${domain.replace(/^https?:\/\//, "")}${path}`;
  return (
    <a href={`https://${url}`} target="_blank" rel="noopener noreferrer" title={`Open ${url} in a new tab`} onClick={(e) => e.stopPropagation()} className={cn("inline-flex min-w-0 items-center gap-1 underline-offset-2 hover:text-fg hover:underline", className)}>
      <span className="truncate">{url}</span><ExternalLink size={12} className="shrink-0" aria-label="(opens in a new tab)" />
    </a>
  );
}

/**
 * The bar at the top of a Location or Website page: what it's showing, and
 * pills to switch. Hidden when the Organization has only one.
 */
export function ScopeBar({ kind }: { kind: "location" | "website" }) {
  const { locationId } = useScope();
  const st = useSetup();
  if (kind === "location" ? locations.length < 2 : websites.length < 2 && locations.length < 2) return null;
  const pill = (active: boolean) => cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] transition-colors", active ? "border-ink bg-ink text-on-ink" : "border-line bg-surface text-muted hover:bg-hover");
  const current = locationId ? websiteFor(locationId) : null;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 inline-flex items-center gap-1 text-[12.5px] text-muted">{kind === "location" ? <MapPin size={13} /> : <Globe size={13} />} Showing</span>
      <button onClick={() => setScope({ locationId: null })} className={pill(!locationId)}>{kind === "location" ? "All locations" : "All websites"}</button>
      {kind === "location"
        ? locations.map((l) => <button key={l.id} onClick={() => setScope({ locationId: l.id })} className={pill(locationId === l.id)}>{shortLocation(l.id)}</button>)
        : websites.filter((w) => st.website[w.id]).map((w) => <button key={w.id} onClick={() => setScope({ locationId: w.locationIds[0] })} className={pill(current?.id === w.id)}>{w.domain}</button>)}
    </div>
  );
}

/** "All locations": one row per Location with the page's key numbers, each opening that Location. */
export function LocationOverview({ columns, row, note }: { columns: string[]; row: (locationId: string) => ReactNode[]; note?: string }) {
  return (
    <Overview
      note={note ?? "Pick a location to see and act on its details."}
      columns={columns}
      rows={locations.map((l) => ({ key: l.id, name: <span className="font-medium">{shortLocation(l.id)}</span>, sub: l.address, cells: row(l.id), open: () => setScope({ locationId: l.id }) }))}
    />
  );
}

/** "All websites": one row per Website. */
export function WebsiteOverview({ columns, row }: { columns: string[]; row: (w: Website) => ReactNode[] }) {
  const st = useSetup();
  return (
    <Overview
      note="Pick a website to see and act on its details."
      columns={columns}
      rows={websites.filter((w) => st.website[w.id]).map((w) => ({ key: w.id, name: <ExternalUrl domain={w.domain} className="font-medium text-fg" />, sub: `Serves ${w.locationIds.map(shortLocation).join(", ")}`, cells: row(w), open: () => setScope({ locationId: w.locationIds[0] }) }))}
    />
  );
}

function Overview({ columns, rows, note }: { columns: string[]; rows: { key: string; name: ReactNode; sub: string; cells: ReactNode[]; open: () => void }[]; note: string }) {
  return (
    <>
      <p className="mt-0 mb-3 text-[13.5px] text-muted">{note}</p>
      <Card pad={false} className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13.5px]">
          <thead>
            <tr className="border-b border-line text-left text-[12px] text-muted">
              <th className="px-5 py-2.5 font-normal" />
              {columns.map((c) => <th key={c} className="px-3 py-2.5 text-right font-normal">{c}</th>)}
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-line last:border-0">
                <td className="px-5 py-3.5"><div>{r.name}</div><div className="text-[12px] text-muted">{r.sub}</div></td>
                {r.cells.map((c, i) => <td key={i} className="num px-3 py-3.5 text-right">{c}</td>)}
                <td className="px-5 py-3.5 text-right"><Button size="sm" onClick={r.open}>Open</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge, Button, Input, Segmented, Select, cn, fmt } from "./ui";
import { PlatformMark } from "./Social";
import { platformMeta, type SocialPlatform } from "../data/social";
import { profileUrl, type WatchKind } from "../data/watch";
import { unwatch, useWatched, watch } from "../lib/watch";

const platforms = (Object.keys(platformMeta) as SocialPlatform[]).filter((p) => p !== "google");

/** The watched profiles, each removable, plus a row to add one: platform, handle, competitor or inspiration. */
export function WatchEditor({ compact = false }: { compact?: boolean }) {
  const list = useWatched();
  const [platform, setPlatform] = useState<SocialPlatform>("instagram");
  const [handle, setHandle] = useState("");
  const [kind, setKind] = useState<WatchKind>("Competitor");
  const add = () => { watch(platform, handle, kind); setHandle(""); };

  return (
    <div>
      <ul className="m-0 list-none p-0">
        {list.map((w) => (
          <li key={w.id} className={cn("flex items-center gap-3 border-b border-line last:border-0", compact ? "px-4 py-2.5" : "px-4 py-3")}>
            <PlatformMark platform={w.platform} size={22} />
            <span className="min-w-0 flex-1">
              <a href={profileUrl(w)} target="_blank" rel="noopener noreferrer" className="block truncate text-[14px] font-medium hover:underline">{w.handle}</a>
              <span className="block truncate text-[12.5px] text-muted">{w.name}{w.followers ? ` · ${fmt(w.followers)} followers` : ""}</span>
            </span>
            <Badge tone={w.kind === "Competitor" ? "warn" : "accent"}>{w.kind}</Badge>
            <button onClick={() => unwatch(w.id)} aria-label={`Stop watching ${w.handle}`} className="grid size-7 place-items-center rounded-md text-subtle hover:bg-hover hover:text-fg"><X size={14} /></button>
          </li>
        ))}
        {!list.length && <li className="px-4 py-4 text-[13px] text-muted">Not watching anyone yet.</li>}
      </ul>
      <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex flex-wrap items-center gap-2 border-t border-line bg-hover/40 px-4 py-3">
        <Select size="sm" aria-label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value as SocialPlatform)} className="w-auto">
          {platforms.map((p) => <option key={p} value={p}>{platformMeta[p].name}</option>)}
        </Select>
        <Input size="sm" aria-label="Handle" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle" className="min-w-0 flex-1" />
        <Segmented label="Why watch" value={kind} onChange={setKind} options={[{ id: "Competitor", label: "Competitor" }, { id: "Inspiration", label: "Inspiration" }]} />
        <Button size="sm" type="submit" icon={<Plus size={13} />} disabled={!handle.trim()}>Watch</Button>
      </form>
    </div>
  );
}

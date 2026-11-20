import { useState } from "react";
import { Link2, Copy, Eye, ExternalLink, Smartphone, Monitor } from "lucide-react";
import { Badge, Button, Input, Modal, Toggle, cn, useToast } from "./ui";
import { ensureShare, setShareEnabled, shareFor, shareUrl, useShares } from "../lib/shares";
import { timeAgo } from "../lib/runs";

/** "Share link" for a sales audit: copy a public URL, see who opened it and for how long. */
export function ShareAuditButton({ path, name }: { path: string; name: string }) {
  const shares = useShares();
  const [open, setOpen] = useState(false);
  const { toast, node } = useToast();
  const s = shareFor(shares, path);
  const views = s?.views ?? [];
  const url = s ? shareUrl(s.token) : "";

  const openModal = () => { ensureShare(path, name); setOpen(true); };
  const copy = async (u: string) => {
    try { await navigator.clipboard.writeText(u); toast("Link copied"); } catch { toast("Couldn't access the clipboard"); }
  };

  return (
    <>
      <Button icon={<Link2 size={14} />} onClick={openModal}>
        Share link{views.length ? <Badge tone="accent" className="num ml-0.5"><Eye size={10} />{views.length}</Badge> : null}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Share this audit" width={560}>
        {s && (
          <div className="space-y-5">
            <p className="text-[13.5px] text-muted">Send this link in your email instead of a PDF. It opens a clean, mobile-friendly audit with a button to book a call. Contact details and your pitch are never shown.</p>
            <div className="flex gap-2">
              <Input size="lg" readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" className={cn("min-w-0 flex-1 font-mono text-[12.5px]", !s.enabled && "text-subtle line-through")} />
              <Button className="h-10" variant="primary" icon={<Copy size={14} />} disabled={!s.enabled} onClick={() => copy(url)}>Copy</Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
              <div>
                <div className="text-[13.5px] font-medium">{s.enabled ? "Anyone with the link can view" : "Link turned off"}</div>
                <div className="text-[12px] text-muted">{s.enabled ? "Turn it off any time; the link then shows “no longer available”." : "Turn it back on to make the same link work again."}</div>
              </div>
              <Toggle label="Link enabled" checked={s.enabled} onChange={(v) => setShareEnabled(s.token, v)} />
            </div>
            <a href={`${url}?preview=1`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg"><ExternalLink size={13} /> Preview as the prospect (doesn't count as a view)</a>

            <section>
              <h4 className="mb-2 flex items-center gap-2 text-[13px] font-medium"><Eye size={14} /> Views {views.length > 0 && <span className="num text-muted">({views.length})</span>}</h4>
              {views.length ? (
                <>
                  {views.length >= 2 && <div className="mb-2 rounded-md bg-good-soft px-3 py-2 text-[13px] text-good">Opened {views.length} times. A good moment to call.</div>}
                  <ul className="divide-y divide-line rounded-lg border border-line">
                    {[...views].reverse().map((v, i) => (
                      <li key={i} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                        {v.device === "Desktop" ? <Monitor size={14} className="text-muted" /> : <Smartphone size={14} className="text-muted" />}
                        <span className="w-24 shrink-0">{timeAgo(v.at)}</span>
                        <span className="num shrink-0 text-muted">{v.seconds >= 60 ? `${Math.floor(v.seconds / 60)}m ${v.seconds % 60}s` : `${v.seconds}s`}</span>
                        <span className="min-w-0 flex-1 truncate text-[12px] text-subtle">{v.sections.length ? `Saw ${v.sections.join(", ")}` : "Bounced from the top"}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : <p className="text-[13px] text-muted">Not opened yet. You'll see each visit here: when, on what device, how long, and which sections they read.</p>}
            </section>
          </div>
        )}
      </Modal>
      {node}
    </>
  );
}

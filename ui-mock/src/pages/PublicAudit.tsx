import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { CalendarCheck, CreditCard, Check, Lock } from "lucide-react";
import { Button, Modal, cn, fmt, useToast } from "../components/ui";
import { Logo } from "../components/Logo";
import { AuditBody } from "./ProspectAudit";
import { findProspect, opportunity, searchMarket, specFromParams } from "../data/prospects";
import { pathFromToken, recordView, updateLastView, useShares, type View } from "../lib/shares";

const device = (): View["device"] => (/iPhone|iPad/.test(navigator.userAgent) ? "iPhone" : /Android/.test(navigator.userAgent) ? "Android" : "Desktop");

/**
 * The page a prospect sees from a shared link (#/a/:token): the same audit,
 * written to "you", without the app around it, contact details or the pitch.
 */
export default function PublicAudit() {
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  const preview = params.get("preview") === "1";
  const shares = useShares();
  const share = shares.find((s) => s.token === token);
  const path = pathFromToken(token);
  const [id, query] = useMemo(() => {
    const m = path?.match(/^\/prospects\/([^?]+)(\?.*)?$/);
    return m ? [m[1], m[2] ?? ""] : [null, ""];
  }, [path]);
  const market = useMemo(() => searchMarket(specFromParams(new URLSearchParams(query.slice(1)))), [query]);
  const p = id ? findProspect(market, id) : undefined;
  const [book, setBook] = useState(false);
  const [booked, setBooked] = useState<string | null>(null);
  const { toast, node } = useToast();

  // Log the visit: time on page and which sections were scrolled into view.
  useEffect(() => {
    if (!p || preview || share?.enabled === false) return;
    const started = Date.now();
    const seen = new Set<string>();
    recordView(token, { at: started, device: device(), seconds: 0, sections: [] });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) seen.add((e.target as HTMLElement).dataset.section!); });
    }, { threshold: 0.4 });
    document.querySelectorAll("[data-section]").forEach((el) => io.observe(el));
    const t = setInterval(() => updateLastView(token, { seconds: Math.round((Date.now() - started) / 1000), sections: [...seen] }), 3000);
    return () => { io.disconnect(); clearInterval(t); updateLastView(token, { seconds: Math.round((Date.now() - started) / 1000), sections: [...seen] }); };
  }, [p?.id, token, preview]);

  if (!p || share?.enabled === false) {
    return (
      <div className="grid min-h-full place-items-center bg-bg p-6 text-center">
        <div>
          <Logo size={22} className="mb-8" />
          <Lock size={28} className="mx-auto text-subtle" />
          <h1 className="mt-3 font-serif text-[26px]">This audit is no longer available</h1>
          <p className="mt-1 text-[14px] text-muted">Ask whoever sent it for a fresh link.</p>
        </div>
      </div>
    );
  }

  const o = opportunity(p, market);
  const slots = ["Tue 10:00", "Tue 2:30", "Wed 9:00", "Wed 4:00", "Thu 11:30", "Fri 1:00"];

  return (
    <div className="min-h-full bg-bg">
      {preview && <div className="bg-ink px-4 py-1.5 text-center text-[12.5px] text-on-ink print:hidden">Preview: this visit isn't counted as a view.</div>}
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur print:static">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center gap-3 px-4 py-3 sm:px-8">
          <Logo size={22} />
          <span className="text-[13.5px] text-muted">· Local visibility audit</span>
          <div className="ml-auto flex gap-2 print:hidden">
            <Button variant="primary" icon={<CalendarCheck size={14} />} onClick={() => setBook(true)}>{booked ? `Booked · ${booked}` : "Book a 15-min walkthrough"}</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1080px] px-4 py-8 sm:px-8">
        <p className="text-[13px] text-muted">Prepared for</p>
        <h1 className="font-serif text-[34px] leading-tight">{p.name}</h1>
        <p className="mt-1 mb-6 text-[14px] text-muted">How you show up when people nearby search “{market.keyword}” · {p.address}</p>

        <AuditBody p={p} market={market} o={o} publicView />

        <section className="mt-10 rounded-xl border border-accent/40 bg-accent-soft/40 p-6 text-center print:hidden">
          <h2 className="font-serif text-[26px]">Want us to fix this?</h2>
          <p className="mx-auto mt-1 max-w-xl text-[14px] text-muted">
            We'll do the {o.easyWins} quick fixes this week, then track your map rankings every week so you can see the change.
            {o.missedRevenue > 0 && <> Reaching the top 3 is worth about <b className="font-medium text-fg">${fmt(o.missedRevenue)} a month</b>.</>}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button variant="primary" icon={<CalendarCheck size={14} />} onClick={() => setBook(true)}>Book a 15-min walkthrough</Button>
            <Button icon={<CreditCard size={14} />} onClick={() => toast("Stripe Checkout opens here · $99/mo, cancel anytime")}>Start now · $99/mo</Button>
          </div>
          <p className="mt-3 text-[12px] text-subtle">Month to month. No contract.</p>
        </section>
      </main>

      <Modal open={book} onClose={() => setBook(false)} title="Pick a time" width={440}>
        <p className="mb-3 text-[13.5px] text-muted">15 minutes on a call or Zoom. We'll walk through your map and the first three fixes.</p>
        <div className="grid grid-cols-2 gap-2">
          {slots.map((t) => (
            <button key={t} onClick={() => { setBooked(t); setBook(false); toast(`Booked for ${t}. A calendar invite is on its way`); }}
              className={cn("flex h-10 items-center justify-center gap-1.5 rounded-md border text-[13.5px] transition-colors", booked === t ? "border-ink bg-ink text-on-ink" : "border-line hover:bg-hover")}>
              {booked === t && <Check size={13} />}{t}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-subtle">Real build: Cal.com embed; a booking moves the prospect to “Booked”.</p>
      </Modal>
      {node}
    </div>
  );
}

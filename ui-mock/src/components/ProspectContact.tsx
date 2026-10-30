import { useState } from "react";
import { Check, Copy, Globe, Mail, Link2, MapPin, MessageSquare, Phone, User, CalendarCheck, Building2, Info } from "lucide-react";
import { Badge, cn, fmt } from "./ui";
import type { Prospect } from "../data/prospects";

const emailTone = { verified: "good", "catch-all": "warn", unverified: "neutral" } as const;
const confTone = { high: "good", medium: "info", low: "neutral" } as const;

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      aria-label={`Copy ${text}`}
      onClick={async (e) => { e.stopPropagation(); try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); } catch { /* clipboard blocked */ } }}
      className="grid size-6 shrink-0 place-items-center rounded text-subtle hover:bg-hover hover:text-fg"
    >
      {done ? <Check size={12} className="text-good" /> : <Copy size={12} />}
    </button>
  );
}

function Row({ icon: I, children, copy }: { icon: typeof Phone; children: React.ReactNode; copy?: string }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5 text-[13px]">
      <I size={14} className="mt-0.5 shrink-0 text-subtle" />
      <div className="min-w-0 flex-1">{children}</div>
      {copy && <CopyBtn text={copy} />}
    </div>
  );
}

/** Icons for the table: who to ask for and how to reach them. */
export function ContactIcons({ p }: { p: Prospect }) {
  const c = p.contact;
  const on = "text-fg", off = "text-line-strong";
  return (
    <div className="min-w-0">
      <div className="truncate text-[13px]">{c.owner ? c.owner.name : <span className="text-subtle">Owner unknown</span>}</div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span title={`${c.phoneType} · ${c.carrier}`}><Phone size={13} className={on} /></span>
        <span title={c.sms ? "Can receive texts" : "Can't receive texts"}><MessageSquare size={13} className={c.sms ? on : off} /></span>
        <span title={c.email ? `${c.email} (${c.emailStatus})` : "No email found"}><Mail size={13} className={c.email ? (c.emailStatus === "verified" ? "text-good" : on) : off} /></span>
        <span title={c.owner ? `${c.owner.title} · ${c.owner.source}` : "No owner found"}><User size={13} className={c.owner ? on : off} /></span>
        <span className="text-[11.5px] text-subtle">{c.phoneType}</span>
      </div>
    </div>
  );
}

/** Everything a seller needs before reaching out. Used in the prospect list and on the audit. */
export function ContactCard({ p, className }: { p: Prospect; className?: string }) {
  const c = p.contact, co = p.company;
  const socials = [
    { icon: Link2, url: c.socials.facebook },
    { icon: Link2, url: c.socials.instagram },
    { icon: Link2, url: c.socials.linkedin },
    { icon: Globe, url: c.socials.yelp },
  ].filter((s): s is { icon: typeof Link2; url: string } => !!s.url);

  return (
    <div className={cn("text-[13px]", className)}>
      <div className="mb-1 text-[12.5px] font-medium text-muted">Decision maker</div>
      {c.owner ? (
        <div className="mb-3 rounded-lg border border-line bg-surface p-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft font-medium text-accent">{c.owner.name.split(" ").map((x) => x[0]).join("")}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{c.owner.name}</div>
              <div className="truncate text-[12px] text-muted">{c.owner.title}</div>
            </div>
            <Badge tone={confTone[c.owner.confidence]} className="capitalize">{c.owner.confidence}</Badge>
          </div>
          <div className="mt-2 text-[12px] text-subtle">Found via {c.owner.source}{c.owner.linkedin && <> · <a href={`https://${c.owner.linkedin}`} target="_blank" rel="noreferrer" className="underline hover:text-fg">LinkedIn</a></>}</div>
        </div>
      ) : (
        <div className="mb-3 rounded-lg border border-dashed border-line p-3 text-[12.5px] text-muted">No owner name found. Ask for “the owner” on the call, or check the state business filing.</div>
      )}

      <div className="divide-y divide-line">
        <Row icon={Phone} copy={p.phone}>
          <a href={`tel:${p.phone.replace(/\D/g, "")}`} className="num hover:underline">{p.phone}</a>
          <span className="ml-2 text-[12px] text-muted">{c.phoneType} · {c.carrier}</span>
        </Row>
        <Row icon={MessageSquare}>
          {c.sms ? <><Badge tone="good">Can text</Badge> <span className="ml-1 text-[12px] text-muted">Get consent before marketing texts</span></> : <span className="text-muted">Landline · calls only</span>}
        </Row>
        <Row icon={Mail} copy={c.email ?? undefined}>
          {c.email ? (
            <>
              <a href={`mailto:${c.email}`} className="break-all hover:underline">{c.email}</a>{" "}
              <Badge tone={emailTone[c.emailStatus!]} className="ml-1">{c.emailStatus}</Badge>
              <div className="text-[12px] text-subtle">{c.emailSource}{c.altEmails.length ? ` · also ${c.altEmails.join(", ")}` : ""}</div>
            </>
          ) : <span className="text-muted">No email found</span>}
        </Row>
        <Row icon={MapPin} copy={p.address}>
          {p.address} {p.zip}
          <div className="num text-[12px] text-subtle">{p.lat}, {p.lng} · {p.distanceMi} mi from centre</div>
        </Row>
        {c.bookingUrl && <Row icon={CalendarCheck}><span className="text-muted">Online booking:</span> {c.bookingUrl}</Row>}
        <Row icon={Building2}>
          {co.founded ? `Since ${co.founded}` : "Founding year unknown"} · {co.employees} employees
          {co.attributes.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{co.attributes.map((a) => <Badge key={a}>{a}</Badge>)}</div>}
        </Row>
        <Row icon={Info}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[12.5px]">
            <span className="text-muted">Website</span><span>{p.website ?? "None"}{co.cms && ` · ${co.cms}`}</span>
            <span className="text-muted">Domain age</span><span>{co.domainAgeYrs ? `${co.domainAgeYrs} yr` : "—"}</span>
            <span className="text-muted">Organic visits</span><span className="num">{p.website ? `${fmt(co.organicTraffic)}/mo` : "—"}</span>
            <span className="text-muted">Google Ads</span><span className="num">{co.adSpend ? `~$${fmt(co.adSpend)}/mo` : "Not running"}</span>
            <span className="text-muted">Tracking</span><span>{[co.analytics && "Analytics", co.adPixel && "Ad pixel", co.chatWidget && "Chat"].filter(Boolean).join(", ") || "None found"}</span>
            <span className="text-muted">Last review</span><span className="num">{p.lastReviewDays}d ago</span>
          </div>
        </Row>
      </div>

      {socials.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {socials.map(({ icon: I, url }) => (
            <a key={url} href={`https://${url}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title={url} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line px-2 text-[12px] text-muted hover:bg-hover hover:text-fg">
              <I size={12} />{url.split("/")[0].replace(".com", "")}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

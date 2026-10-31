import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, Globe, KeyRound, Loader2, PhoneForwarded, Search, ShieldCheck, Webhook } from "lucide-react";
import { Badge, Button, Field, Input, Modal, Select, Textarea, cn } from "./ui";
import { brandFacts } from "../data/brand";
import { business } from "../data/mock";
import { emailProviders, phoneProviders, searchNumbers, type DnsRecord, type EmailProviderId, type Field as KeyField, type PhoneProviderId } from "../data/providers";
import type { PhoneNumber, Reg } from "../data/messaging";
import { recipes } from "../data/messaging";
import { addNumbers, checkDns, connectEmail, connectPhone, registerTexting, useCrm, withExamples } from "../lib/crm";
import { product } from "../lib/whitelabel";

export function ProviderMark({ mark, color, size = 32 }: { mark: string; color: string; size?: number }) {
  const dark = ["#ffde00", "#ff9900"].includes(color);
  return <span className="grid shrink-0 place-items-center rounded-lg font-semibold" style={{ width: size, height: size, background: color, color: dark ? "#111" : "#fff", fontSize: size * (mark.length > 2 ? 0.3 : 0.38) }}>{mark}</span>;
}

function Pick<T extends string>({ items, onPick }: { items: Record<T, { name: string; mark: string; color: string; blurb: string; good: string[] }>; onPick: (id: T) => void }) {
  return (
    <ul className="space-y-2">
      {(Object.keys(items) as T[]).map((id, i) => {
        const p = items[id];
        return (
          <li key={id}>
            <button onClick={() => onPick(id)} className="flex w-full items-start gap-3 rounded-xl border border-line p-3.5 text-left hover:border-line-strong hover:bg-hover">
              <ProviderMark mark={p.mark} color={p.color} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5 text-[14px] font-medium">{p.name}{i === 0 && <Badge tone="accent">Recommended</Badge>}{p.good.filter((g) => g !== "Easiest").map((g) => <Badge key={g}>{g}</Badge>)}</span>
                <span className="block text-[12.5px] text-muted">{p.blurb}</span>
              </span>
              <ChevronRight size={16} className="mt-2 shrink-0 text-subtle" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Keys({ fields, where, values, onChange }: { fields: KeyField[]; where: string; values: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <Field key={f.key} label={f.label}>
          {f.options
            ? <Select value={values[f.key] ?? f.options[0]} onChange={(e) => onChange({ ...values, [f.key]: e.target.value })}>{f.options.map((o) => <option key={o}>{o}</option>)}</Select>
            : <Input type={f.secret ? "password" : "text"} autoComplete="off" value={values[f.key] ?? ""} onChange={(e) => onChange({ ...values, [f.key]: e.target.value })} placeholder={f.placeholder} className="font-mono text-[12.5px]" />}
        </Field>
      ))}
      <p className="flex items-start gap-2 text-[12.5px] text-muted"><KeyRound size={13} className="mt-0.5 shrink-0" />Find it in {where} Keys are stored encrypted and only used to send, read delivery events and receive replies.</p>
    </div>
  );
}

const Back = ({ onClick, label }: { onClick: () => void; label: string }) => <button onClick={onClick} className="mb-3 inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-fg"><ChevronLeft size={13} />{label}</button>;
const Steps = ({ names, at }: { names: string[]; at: number }) => (
  <ol className="mb-4 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
    {names.map((n, i) => <li key={n} className={cn("flex items-center gap-1", i === at ? "font-medium text-fg" : i < at ? "text-good" : "text-subtle")}>{i < at ? <Check size={11} /> : <span className="num">{i + 1}.</span>}{n}</li>)}
  </ol>
);

// ---------- Email ----------

export function DnsTable({ records }: { records: DnsRecord[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (k: string, v: string) => { navigator.clipboard?.writeText(v); setCopied(k); setTimeout(() => setCopied(null), 1200); };
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
      {records.map((r, i) => (
        <li key={i} className="space-y-1 px-3 py-2.5 text-[12.5px]">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{r.type}</Badge><span className="text-muted">{r.purpose}</span>
            <span className="ml-auto">{r.ok ? <Badge tone="good"><Check size={10} />Found</Badge> : <Badge tone="warn">Not found yet</Badge>}</span>
          </div>
          {[["Host", r.host], ["Value", r.value]].map(([k, v]) => (
            <div key={k} className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-subtle">{k}</span>
              <code className="min-w-0 flex-1 truncate font-mono text-[11.5px]" title={v}>{v}</code>
              <button onClick={() => copy(`${i}${k}`, v)} aria-label={`Copy ${k.toLowerCase()}`} className="shrink-0 rounded p-1 text-subtle hover:bg-hover hover:text-fg">{copied === `${i}${k}` ? <Check size={12} className="text-good" /> : <Copy size={12} />}</button>
            </div>
          ))}
        </li>
      ))}
    </ul>
  );
}

/**
 * Pick who sends the email, connect it, choose the sending domain, add the DNS
 * records, verify. Webhooks for delivery, bounces, complaints, clicks and
 * replies are registered on the provider by OpenMarko.
 */
export function EmailSetup({ open, onClose, toast, initial }: { open: boolean; onClose: () => void; toast: (m: string) => void; initial?: EmailProviderId }) {
  const st = useCrm();
  const e = st.channels.email;
  const [step, setStep] = useState<"pick" | "keys" | "domain" | "dns" | "done">(e.provider && !e.verified ? "dns" : "pick");
  const [provider, setProvider] = useState<EmailProviderId>(initial ?? e.provider ?? "managed");
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [domain, setDomain] = useState(`mail.${brandFacts.website}`);
  const [fromName, setFromName] = useState(brandFacts.name);
  const [local, setLocal] = useState("hello");
  const [err, setErr] = useState<string | null>(null);
  const p = emailProviders[provider];
  const idx = ["pick", "keys", "domain", "dns", "done"].indexOf(step);
  const check = () => { setBusy(true); checkDns((missing) => { setBusy(false); setStep("done"); toast(missing ? `Verified. ${missing} optional record still missing` : "Domain verified"); }); };

  return (
    <Modal open={open} onClose={onClose} title="Set up email sending" width={620}>
      <Steps names={["Provider", "Connect", "Domain", "DNS", "Done"]} at={idx} />
      {step === "pick" && (
        <>
          <p className="mb-3 text-[13.5px] text-muted">Campaigns, workflows and Inbox replies go out through this. You can switch later without losing anything.</p>
          <Pick items={emailProviders} onPick={(id) => { setProvider(id); setKeys({}); setStep(emailProviders[id].fields.length ? "keys" : "domain"); }} />
        </>
      )}
      {step === "keys" && (
        <>
          <Back onClick={() => setStep("pick")} label="All providers" />
          <div className="mb-4 flex items-center gap-3"><ProviderMark mark={p.mark} color={p.color} size={36} /><div><div className="text-[15px] font-medium">Connect {p.name}</div><div className="text-[12.5px] text-muted">{p.privacy}</div></div></div>
          <Keys fields={p.fields} where={p.where} values={keys} onChange={setKeys} />
          {err && <p className="mt-3 rounded-md bg-bad-soft px-3 py-2 text-[13px] text-bad">{err}</p>}
          <Button variant="primary" className="mt-4 w-full" disabled={busy} icon={busy ? <Loader2 size={14} className="animate-spin" /> : undefined}
            onClick={() => { const missing = p.fields.find((f) => !f.options && (keys[f.key] ?? "").trim().length < 8); if (missing) return setErr(`${missing.label} looks too short. Copy the whole value.`); setErr(null); setBusy(true); setTimeout(() => { setBusy(false); setStep("domain"); }, 1200); }}>
            {busy ? `Checking ${p.name}…` : `Connect ${p.name}`}
          </Button>
        </>
      )}
      {step === "domain" && (
        <>
          <Back onClick={() => setStep(p.fields.length ? "keys" : "pick")} label="Back" />
          <div className="space-y-3">
            <Field label="Send from this domain"><Input value={domain} onChange={(ev) => setDomain(ev.target.value.trim().toLowerCase())} /></Field>
            <p className="flex items-start gap-2 rounded-lg bg-hover px-3 py-2.5 text-[12.5px] text-muted"><Globe size={13} className="mt-0.5 shrink-0" /><span>We suggest a subdomain like <b>mail.{brandFacts.website}</b>. If a campaign ever gets marked as spam, your everyday email from {brandFacts.website} isn't affected. Replies still reach you.</span></p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="From name"><Input value={fromName} onChange={(ev) => setFromName(ev.target.value)} /></Field>
              <Field label="From address"><span className="flex items-center gap-1"><Input value={local} onChange={(ev) => setLocal(ev.target.value)} className="w-28" /><span className="truncate text-[13px] text-muted">@{domain}</span></span></Field>
            </div>
          </div>
          <Button variant="primary" className="mt-4 w-full" disabled={!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) || !local} onClick={() => { connectEmail(provider, domain, fromName, local, keys.region ?? (p.fields.find((f) => f.key === "region")?.options?.[0])); setStep("dns"); }}>Get the DNS records</Button>
        </>
      )}
      {step === "dns" && (
        <>
          <p className="mb-3 text-[13.5px] text-muted">Add these at whoever hosts <b>{e.domain.split(".").slice(-2).join(".")}</b>'s DNS. They prove the email is really from you, so it lands in the inbox.</p>
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2.5">
            <span className="text-[13px]">Your DNS is at <b>Cloudflare</b>.</span>
            <span className="flex-1" />
            <Button size="sm" variant="primary" onClick={() => { toast("Signed in to Cloudflare. Records added"); check(); }}>Add them for me</Button>
            <Button size="sm" onClick={() => toast("Instructions copied. Send them to whoever manages your website")}>Copy instructions</Button>
          </div>
          <DnsTable records={e.records} />
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[12px] text-subtle">DNS changes can take a few minutes, sometimes an hour.</span>
            <span className="flex-1" />
            <Button variant="primary" disabled={busy} icon={busy ? <Loader2 size={14} className="animate-spin" /> : undefined} onClick={check}>{busy ? "Looking them up…" : "Check now"}</Button>
          </div>
        </>
      )}
      {step === "done" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-good-soft px-3 py-2.5 text-[13.5px] font-medium text-good"><Check size={16} />Sending from {e.fromAddress} through {emailProviders[e.provider ?? "managed"].name}</div>
          <ul className="space-y-1.5 text-[13px]">
            <li className="flex items-start gap-2"><Webhook size={14} className="mt-0.5 shrink-0 text-muted" />Delivery, bounce, spam complaint, open and click events come back to {product()}</li>
            <li className="flex items-start gap-2"><PhoneForwarded size={14} className="mt-0.5 shrink-0 text-muted" />Replies to {e.fromAddress} land in the Inbox and are forwarded to {e.replyTo}</li>
            <li className="flex items-start gap-2"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-muted" />Hard bounces and complaints are unsubscribed on their own, to protect your domain</li>
          </ul>
          <div className="flex gap-2 pt-1"><Button onClick={() => toast("Test email sent to you")}>Send me a test</Button><span className="flex-1" /><Button variant="primary" onClick={onClose}>Done</Button></div>
        </div>
      )}
    </Modal>
  );
}

// ---------- Phone ----------

type How = PhoneNumber["how"];
const howMeta: Record<How, { label: string; hint: string }> = {
  new: { label: "Get a new local number", hint: "Live in a minute. Put it on your ads and website for texting and tracking." },
  hosted: { label: "Text-enable my current number", hint: `Keep your number and phone company for calls; texts come through ${product()}. Needs a signed letter of authorization, about 3–5 days.` },
  port: { label: "Move my number here", hint: "Calls and texts both move. Needs your latest bill and account PIN, 1–2 weeks. Calls keep working during the move." },
};

export const regLabel = (r: Reg) => ({ none: "Not filed", pending: "In review", approved: "Approved", rejected: "Rejected" })[r];
export const regTone = (r: Reg) => (r === "approved" ? "good" : r === "pending" ? "info" : r === "rejected" ? "bad" : "neutral") as "good" | "info" | "bad" | "neutral";

/**
 * Texting and calls: pick a provider, get or bring a number per location, and
 * file the carrier registration (A2P 10DLC) that US carriers require before a
 * business number can text.
 */
export function PhoneSetup({ open, onClose, toast, startAt, initial }: { open: boolean; onClose: () => void; toast: (m: string) => void; startAt?: "numbers"; initial?: PhoneProviderId }) {
  const st = useCrm();
  const sms = st.channels.sms;
  const [step, setStep] = useState<"pick" | "keys" | "numbers" | "register" | "done">(startAt ?? "pick");
  const [provider, setProvider] = useState<PhoneProviderId>(initial ?? sms.provider ?? "managed");
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const locs = brandFacts.locations;
  const [plan, setPlan] = useState<Record<string, { how: How; area: string; pick: string; existing: string }>>(() => Object.fromEntries(locs.map((l) => [l, { how: "new" as How, area: "512", pick: "", existing: brandFacts.phone }])));
  const [searched, setSearched] = useState<Record<string, string[]>>({});
  const [reg, setReg] = useState({
    legal: `${brandFacts.name} PLLC`, ein: "", type: "Private company", address: business.address, website: `https://${brandFacts.website}`,
    useCase: "Mixed: appointment reminders, customer care and marketing",
    description: `${brandFacts.name} texts patients and people who asked about our services: appointment confirmations and reminders, replies to their questions, review requests and occasional offers.`,
    optIn: "People agree to texts by ticking an unchecked box on our website forms, Meta lead forms or the patient intake form, or by texting us first. The box says message frequency varies, data rates may apply, reply STOP to opt out.",
    sample1: withExamples(recipes.find((r) => r.id === "reminders")!.steps()[0].body!),
    sample2: withExamples(recipes.find((r) => r.id === "speed")!.steps()[1].body!) + " Reply STOP to opt out.",
  });
  const p = phoneProviders[provider];
  const idx = ["pick", "keys", "numbers", "register", "done"].indexOf(step);
  const planOk = locs.every((l) => (plan[l].how === "new" ? !!plan[l].pick : plan[l].existing.replace(/\D/g, "").length === 10));
  const saveNumbers = () => {
    addNumbers(locs.map((l) => ({ location: l, how: plan[l].how, number: plan[l].how === "new" ? plan[l].pick : plan[l].existing, status: plan[l].how === "new" ? "active" : "pending" })));
    setStep(sms.campaign === "approved" ? "done" : "register");
  };
  const set = (l: string, patch: Partial<(typeof plan)[string]>) => setPlan({ ...plan, [l]: { ...plan[l], ...patch } });

  return (
    <Modal open={open} onClose={onClose} title="Set up texting & calls" width={640}>
      <Steps names={["Provider", "Connect", "Numbers", "Carrier registration", "Done"]} at={idx} />
      {step === "pick" && (
        <>
          <p className="mb-3 text-[13.5px] text-muted">One number per location for texts and calls. Replies and missed calls land in the Inbox.</p>
          <Pick items={phoneProviders} onPick={(id) => { setProvider(id); setStep(phoneProviders[id].fields.length ? "keys" : "numbers"); if (!phoneProviders[id].fields.length) connectPhone(id); }} />
        </>
      )}
      {step === "keys" && (
        <>
          <Back onClick={() => setStep("pick")} label="All providers" />
          <div className="mb-4 flex items-center gap-3"><ProviderMark mark={p.mark} color={p.color} size={36} /><div className="text-[15px] font-medium">Connect {p.name}</div></div>
          <Keys fields={p.fields} where={p.where} values={keys} onChange={setKeys} />
          <Button variant="primary" className="mt-4 w-full" disabled={busy || p.fields.some((f) => (keys[f.key] ?? "").length < 8)} icon={busy ? <Loader2 size={14} className="animate-spin" /> : undefined}
            onClick={() => { setBusy(true); setTimeout(() => { setBusy(false); connectPhone(provider); setStep("numbers"); }, 1200); }}>{busy ? `Checking ${p.name}…` : `Connect ${p.name}`}</Button>
        </>
      )}
      {step === "numbers" && (
        <>
          <div className="space-y-4">
            {locs.map((l) => {
              const x = plan[l];
              return (
                <section key={l} className="rounded-xl border border-line p-3.5">
                  <div className="mb-2 text-[14px] font-medium">{l}</div>
                  <div className="space-y-1.5" role="radiogroup" aria-label={`Number for ${l}`}>
                    {(Object.keys(howMeta) as How[]).map((h) => (
                      <button key={h} role="radio" aria-checked={x.how === h} onClick={() => set(l, { how: h })} className={cn("flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left", x.how === h ? "border-ink" : "border-line hover:border-line-strong")}>
                        <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border", x.how === h ? "border-ink" : "border-line-strong")}>{x.how === h && <span className="size-2 rounded-full bg-ink" />}</span>
                        <span><span className="block text-[13px] font-medium">{howMeta[h].label}</span><span className="block text-[12px] text-muted">{howMeta[h].hint}</span></span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3">
                    {x.how === "new" ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Input value={x.area} onChange={(e) => set(l, { area: e.target.value.replace(/\D/g, "").slice(0, 3) })} aria-label="Area code" placeholder="Area code" className="w-28" />
                          <Button size="sm" icon={<Search size={12} />} onClick={() => setSearched({ ...searched, [l]: searchNumbers(x.area) })}>Find numbers</Button>
                        </div>
                        {searched[l] && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {searched[l].map((n) => <button key={n} onClick={() => set(l, { pick: n })} aria-pressed={x.pick === n} className={cn("num h-8 rounded-full border px-3 text-[12.5px]", x.pick === n ? "border-ink bg-ink text-on-ink" : "border-line hover:border-line-strong")}>{n}</button>)}
                          </div>
                        )}
                      </>
                    ) : (
                      <Input value={x.existing} onChange={(e) => set(l, { existing: e.target.value })} aria-label="Your current number" className="w-48" />
                    )}
                  </div>
                </section>
              );
            })}
          </div>
          <Button variant="primary" className="mt-4 w-full" disabled={!planOk} onClick={saveNumbers}>{planOk ? "Next" : "Pick a number for each location"}</Button>
        </>
      )}
      {step === "register" && (
        <>
          <p className="mb-3 text-[13px] text-muted">US carriers block texts from business numbers that aren't registered (A2P 10DLC). We've filled in what we know; check it and add your EIN. There's a small one-time carrier fee and a few dollars a month.</p>
          <div className="space-y-3">
            <div className="text-[12.5px] font-medium tracking-wide text-subtle uppercase">Your business</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Legal business name"><Input value={reg.legal} onChange={(e) => setReg({ ...reg, legal: e.target.value })} /></Field>
              <Field label="EIN (tax ID)"><Input value={reg.ein} onChange={(e) => setReg({ ...reg, ein: e.target.value })} placeholder="12-3456789" /></Field>
              <Field label="Business type"><Select value={reg.type} onChange={(e) => setReg({ ...reg, type: e.target.value })}><option>Private company</option><option>Sole proprietor</option><option>Nonprofit</option></Select></Field>
              <Field label="Website"><Input value={reg.website} onChange={(e) => setReg({ ...reg, website: e.target.value })} /></Field>
            </div>
            <Field label="Address (must match the IRS record)"><Input value={reg.address} onChange={(e) => setReg({ ...reg, address: e.target.value })} /></Field>
            <div className="pt-2 text-[12.5px] font-medium tracking-wide text-subtle uppercase">What you'll text</div>
            <Field label="Use case"><Select value={reg.useCase} onChange={(e) => setReg({ ...reg, useCase: e.target.value })}><option>Mixed: appointment reminders, customer care and marketing</option><option>Customer care and reminders only</option><option>Marketing only</option></Select></Field>
            {(["description", "optIn", "sample1", "sample2"] as const).map((k) => (
              <Field key={k} label={<>{{ description: "What the messages are for", optIn: "How people agree to texts", sample1: "Sample message 1", sample2: "Sample message 2" }[k]}</>}>
                <Textarea value={reg[k]} onChange={(e) => setReg({ ...reg, [k]: e.target.value })} rows={k === "optIn" || k === "description" ? 3 : 2} className="p-2.5 text-[13px]" />
              </Field>
            ))}
            <p className="text-[12px] text-subtle">Most rejections come from a vague opt-in description or a website without a privacy policy that mentions texting. Ours links yours at {brandFacts.website}/privacy.</p>
          </div>
          <Button variant="primary" className="mt-4 w-full" disabled={!/^\d{2}-?\d{7}$/.test(reg.ein.trim())} onClick={() => { registerTexting(); setStep("done"); }}>{/^\d{2}-?\d{7}$/.test(reg.ein.trim()) ? "Submit to the carriers" : "Add your EIN to submit"}</Button>
        </>
      )}
      {step === "done" && (
        <div className="space-y-3">
          <ul className="divide-y divide-line rounded-lg border border-line text-[13px]">
            {sms.numbers.map((n) => <li key={n.number} className="flex flex-wrap items-center gap-2 px-3 py-2.5"><span className="w-32">{n.location}</span><span className="num flex-1">{n.number}</span><span className="text-[12px] text-muted">{howMeta[n.how].label.replace("my current number", "").replace("Get a ", "").replace("Move my number here", "Moving here")}</span><Badge tone={n.status === "active" ? "good" : "info"}>{n.status === "active" ? "Live" : "Setting up"}</Badge></li>)}
            <li className="flex items-center gap-2 px-3 py-2.5"><span className="flex-1">Business registration</span><Badge tone={regTone(sms.brand)}>{sms.brand === "pending" && <Loader2 size={10} className="animate-spin" />}{regLabel(sms.brand)}</Badge></li>
            <li className="flex items-center gap-2 px-3 py-2.5"><span className="flex-1">Texting campaign</span><Badge tone={regTone(sms.campaign)}>{sms.campaign === "pending" && <Loader2 size={10} className="animate-spin" />}{regLabel(sms.campaign)}</Badge></li>
          </ul>
          <p className="text-[12.5px] text-muted">{sms.campaign === "approved" ? "Texting is live. Missed calls get texted back and workflows can send texts." : "Calls work now. Texts start once the carriers approve the campaign, usually 1–3 weeks. We'll email you."}</p>
          <div className="flex justify-end"><Button variant="primary" onClick={onClose}>Done</Button></div>
        </div>
      )}
    </Modal>
  );
}

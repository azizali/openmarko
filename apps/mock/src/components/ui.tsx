import { useEffect, useId, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ArrowDown, ArrowUp, Minus, Search, X } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Joins class names; a later class wins over an earlier one for the same property (shadcn's cn). */
export const cn = (...c: ClassValue[]) => twMerge(clsx(c));
export const fmt = (n: number) => n.toLocaleString("en-US");

// ---------- Primitives ----------

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "accent" | "danger";
  size?: "sm" | "md";
  icon?: ReactNode;
};

export function Button({ variant = "secondary", size = "md", icon, className, children, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors duration-150 disabled:opacity-50",
        size === "sm" ? "h-7 rounded-md px-2.5 text-[13px]" : "h-9 px-3.5 text-[13.5px]",
        variant === "primary" && "bg-ink text-on-ink shadow-card hover:opacity-85",
        variant === "accent" && "bg-accent text-white hover:opacity-90",
        variant === "secondary" && "border border-line bg-surface text-fg shadow-card hover:border-line-strong hover:bg-hover",
        variant === "ghost" && "text-muted hover:bg-hover hover:text-fg",
        variant === "danger" && "border border-line bg-surface text-bad hover:bg-bad-soft",
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function Card({ className, children, pad = true }: { className?: string; children: ReactNode; pad?: boolean }) {
  return <div className={cn("rounded-xl border border-line bg-surface shadow-card", pad && "p-5", className)}>{children}</div>;
}

export function CardHeader({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-[14px] font-medium">{title}</h3>
        {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

type Tone = "neutral" | "good" | "bad" | "warn" | "info" | "accent";
const toneCls: Record<Tone, string> = {
  neutral: "bg-hover text-muted",
  good: "bg-good-soft text-good",
  bad: "bg-bad-soft text-bad",
  warn: "bg-warn-soft text-warn",
  info: "bg-info-soft text-info",
  accent: "bg-accent-soft text-accent",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium leading-4", toneCls[tone], className)}>{children}</span>;
}

export function Dot({ tone }: { tone: Tone }) {
  const c = { neutral: "bg-subtle", good: "bg-good", bad: "bg-bad", warn: "bg-warn", info: "bg-info", accent: "bg-accent" }[tone];
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", c)} aria-hidden />;
}

/** Rank change: lower position = better, so prev - cur > 0 is an improvement. */
export function RankDelta({ cur, prev }: { cur: number | null; prev: number | null }) {
  if (cur === null || prev === null) return <span className="text-subtle">—</span>;
  const d = prev - cur;
  if (d === 0) return <span className="inline-flex items-center text-subtle"><Minus size={12} /></span>;
  return (
    <span className={cn("num inline-flex items-center gap-0.5 font-medium", d > 0 ? "text-good" : "text-bad")}>
      {d > 0 ? <ArrowUp size={12} strokeWidth={2.5} /> : <ArrowDown size={12} strokeWidth={2.5} />}
      {Math.abs(d)}
    </span>
  );
}

/** Metric change where higher is better. */
export function Delta({ cur, prev, suffix = "%", invert = false }: { cur: number; prev: number; suffix?: string; invert?: boolean }) {
  const pct = prev === 0 ? 0 : ((cur - prev) / prev) * 100;
  const good = invert ? pct < 0 : pct > 0;
  if (Math.abs(pct) < 0.05) return <span className="text-subtle">0{suffix}</span>;
  return (
    <span className={cn("num inline-flex items-center gap-0.5 text-[12.5px] font-medium", good ? "text-good" : "text-bad")}>
      {pct > 0 ? <ArrowUp size={12} strokeWidth={2.5} /> : <ArrowDown size={12} strokeWidth={2.5} />}
      {Math.abs(pct).toFixed(1)}
      {suffix}
    </span>
  );
}

export function Stat({ label, value, delta, hint }: { label: string; value: ReactNode; delta?: ReactNode; hint?: string }) {
  return (
    <div>
      <div className="text-[12.5px] text-muted" title={hint}>{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="num font-serif text-[30px] leading-none tracking-tight">{value}</span>
        {delta}
      </div>
    </div>
  );
}

export function PageHeader({ title, sub, actions, crumbs }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; crumbs?: ReactNode }) {
  return (
    <div className="mb-7">
      {crumbs && <div className="mb-3 text-[13px] text-muted">{crumbs}</div>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-[34px] leading-[1.1] tracking-[-0.02em]">{title}</h1>
          {sub && <p className="mt-1.5 max-w-2xl text-[14px] text-muted">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex gap-5 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 text-[13.5px] whitespace-nowrap transition-colors",
            value === t.id ? "border-ink text-fg" : "border-transparent text-muted hover:text-fg",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="num rounded-full bg-hover px-1.5 text-[11.5px] text-muted">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-hover p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn("h-7 rounded-md px-2.5 text-[13px] transition-colors", value === o.id ? "bg-surface font-medium text-fg shadow-sm" : "text-muted hover:text-fg")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-ink" : "bg-line-strong")}
    >
      <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-surface shadow-sm transition-transform", checked && "translate-x-4")} />
    </button>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="size-4 cursor-pointer rounded border-line-strong accent-[var(--ink)]"
    />
  );
}

// ---------- Form fields ----------
// One look for every text box, dropdown and text area. Pass className to
// change width, height or spacing; it wins over the defaults.

/** xs sits beside small buttons in a toolbar row; lg beside a primary action. */
export type FieldSize = "xs" | "sm" | "md" | "lg";
const fieldBase = "w-full rounded-lg border border-line bg-surface text-[13.5px] text-fg outline-none transition-colors placeholder:text-subtle focus:border-line-strong focus-within:border-line-strong disabled:opacity-70";
const fieldSizes: Record<FieldSize, string> = { xs: "h-7 rounded-md px-2 text-[12.5px]", sm: "h-8 px-2.5 text-[13px]", md: "h-9 px-3", lg: "h-10 px-3" };
/** Field classes for markup that can't use Input/Select. */
export const fieldClass = (size: FieldSize = "md", className?: string) => cn(fieldBase, fieldSizes[size], className);

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: FieldSize;
  /** Shown inside the box, before the text. */
  icon?: ReactNode;
  /** Shown inside the box, after the text: a unit, a clear button. */
  end?: ReactNode;
  ref?: Ref<HTMLInputElement>;
};
export function Input({ size = "md", icon, end, className, ...rest }: InputProps) {
  if (!icon && !end) return <input {...rest} className={fieldClass(size, className)} />;
  // The border moves to a wrapper so the icon sits inside the box; className sizes the box.
  return (
    <span className={fieldClass(size, cn("flex items-center gap-2", className))}>
      {icon && <span className="flex shrink-0 text-subtle">{icon}</span>}
      <input {...rest} className="h-full w-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-subtle" />
      {end}
    </span>
  );
}

/** A text box with a search icon. */
export function SearchInput({ size = "md", ...rest }: Omit<InputProps, "icon">) {
  return <Input size={size} icon={<Search size={size === "xs" || size === "sm" ? 13 : 15} />} {...rest} />;
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & { size?: FieldSize; ref?: Ref<HTMLSelectElement> };
export function Select({ size = "md", className, ...rest }: SelectProps) {
  return <select {...rest} className={fieldClass(size, className)} />;
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean; ref?: Ref<HTMLTextAreaElement> };
export function Textarea({ mono, className, ...rest }: TextareaProps) {
  return <textarea {...rest} className={cn(fieldBase, "resize-y p-3 leading-[1.55]", mono && "font-mono text-[12.5px] leading-[1.6]", className)} />;
}

/** The text above a field. On its own, for a group of buttons that isn't a single input. */
export function FieldLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("mb-1.5 block text-[12.5px] font-medium text-muted", className)}>{children}</span>;
}

/** A label above a field, with an optional hint below it. */
export function Field({ label, hint, className, children }: { label: ReactNode; hint?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <label className={cn("block", className)}>
      <FieldLabel>{label}</FieldLabel>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-subtle">{hint}</span>}
    </label>
  );
}

export function Progress({ value, tone = "ink", className }: { value: number; tone?: "ink" | "good" | "warn" | "bad" | "accent" | "info"; className?: string }) {
  const c = { ink: "bg-ink", good: "bg-good", warn: "bg-warn", bad: "bg-bad", accent: "bg-accent", info: "bg-info" }[tone];
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-hover", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", c)} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export function ScoreRing({ score, size = 72, stroke = 6, label }: { score: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? "var(--good)" : score >= 60 ? "var(--warn)" : "var(--bad)";
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${label ?? "Score"} ${score} of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hover)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <span className="num absolute font-serif" style={{ fontSize: size * 0.32 }}>{score}</span>
    </div>
  );
}

// ---------- Overlays ----------

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
}

export function Drawer({ open, onClose, title, children, footer, width = 520 }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/20 anim-fade" onClick={onClose} />
      <aside role="dialog" aria-modal="true" className="anim-slide absolute top-0 right-0 flex h-full max-w-full flex-col border-l border-line bg-surface shadow-float" style={{ width }}>
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0 text-[15px] font-medium">{title}</div>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:bg-hover"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-3">{footer}</div>}
      </aside>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, width = 480 }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/25 anim-fade" onClick={onClose} />
      {/* Capped to the viewport: header and footer stay put, the body scrolls. */}
      <div role="dialog" aria-modal="true" className="anim-fade relative flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-xl border border-line bg-surface shadow-float" style={{ maxWidth: width }}>
        <div className="flex shrink-0 items-center justify-between px-6 pt-5 pb-1">
          <h2 className="font-serif text-[22px]">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:bg-hover"><X size={16} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">{children}</div>
        {footer && <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line px-6 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  const node = msg ? (
    <div role="status" className="anim-fade fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-4 py-2.5 text-[13.5px] text-on-ink shadow-float">{msg}</div>
  ) : null;
  return { toast: setMsg, node };
}

// ---------- Charts ----------

export function Sparkline({ data, width = 72, height = 22, invert = false, tone }: { data: (number | null)[]; width?: number; height?: number; invert?: boolean; tone?: "good" | "bad" | "muted" }) {
  const vals = data.filter((d): d is number => d !== null);
  if (vals.length < 2) return <span className="text-subtle">—</span>;
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const pts = data
    .map((d, i) => (d === null ? null : `${(i / (data.length - 1)) * width},${invert ? ((d - min) / span) * (height - 4) + 2 : height - 2 - ((d - min) / span) * (height - 4)}`))
    .filter(Boolean)
    .join(" ");
  const first = vals[0], last = vals[vals.length - 1];
  const auto = (invert ? last < first : last > first) ? "good" : last === first ? "muted" : "bad";
  const stroke = { good: "var(--good)", bad: "var(--bad)", muted: "var(--subtle)" }[tone ?? auto];
  return (
    <svg width={width} height={height} aria-hidden>
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

type Series = { name: string; color: string; values: (number | null)[]; dashed?: boolean };

/** Line chart with optional inverted y-axis (for rank positions where 1 is top). */
export function LineChart({ labels, series, height = 220, invert = false, yMax, area = false, format = (v: number) => String(v) }: { labels: string[]; series: Series[]; height?: number; invert?: boolean; yMax?: number; area?: boolean; format?: (v: number) => string }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = height, pl = 36, pr = 12, pt = 12, pb = 26;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const lo = invert ? 1 : Math.min(0, ...all);
  const hi = yMax ?? Math.ceil(Math.max(...all) * (invert ? 1.1 : 1.15));
  const x = (i: number) => pl + (i / Math.max(1, labels.length - 1)) * (W - pl - pr);
  const y = (v: number) => (invert ? pt + ((v - lo) / (hi - lo)) * (H - pt - pb) : H - pb - ((v - lo) / (hi - lo)) * (H - pt - pb));
  const ticks = Array.from({ length: 5 }, (_, i) => Math.round(lo + ((hi - lo) * i) / 4));
  const step = Math.ceil(labels.length / 6);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} onMouseLeave={() => setHover(null)} role="img" aria-label={series.map((s) => s.name).join(", ") + " chart"}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray="2 4" />
            <text x={pl - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--subtle)" className="num">{format(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => i % step === 0 && (
          <text key={l + i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--subtle)">{l}</text>
        ))}
        {series.map((s, si) => {
          const pts = s.values.map((v, i) => (v === null ? null : [x(i), y(v)] as const)).filter((p): p is readonly [number, number] => p !== null);
          const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
          return (
            <g key={s.name}>
              {area && si === 0 && pts.length > 1 && (
                <>
                  <defs>
                    <linearGradient id={`${id}-g`} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity="0.14" />
                      <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`${d} L${pts[pts.length - 1][0]},${H - pb} L${pts[0][0]},${H - pb} Z`} fill={`url(#${id}-g)`} />
                </>
              )}
              <path d={d} fill="none" stroke={s.color} strokeWidth={1.75} strokeDasharray={s.dashed ? "4 4" : undefined} strokeLinejoin="round" />
            </g>
          );
        })}
        {labels.map((_, i) => (
          <rect key={i} x={x(i) - (W - pl - pr) / labels.length / 2} y={pt} width={(W - pl - pr) / labels.length} height={H - pt - pb} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={pt} y2={H - pb} stroke="var(--border-strong)" />
            {series.map((s) => s.values[hover] !== null && <circle key={s.name} cx={x(hover)} cy={y(s.values[hover]!)} r={3.5} fill="var(--surface)" stroke={s.color} strokeWidth={2} />)}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-sm" style={{ left: `min(calc(${(x(hover) / W) * 100}% + 8px), calc(100% - 140px))` }}>
          <div className="mb-0.5 text-muted">{labels[hover]}</div>
          {series.map((s) => (
            <div key={s.name} className="num flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-2.5" style={{ background: s.color }} />
              {s.name}: <b className="font-medium">{s.values[hover] === null ? "—" : format(s.values[hover]!)}</b>
            </div>
          ))}
        </div>
      )}
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-4 pl-9 text-[12px] text-muted">
          {series.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-3" style={{ background: s.color, opacity: s.dashed ? 0.7 : 1 }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export const shortDate = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function rankTone(rank: number | null): "good" | "warn" | "bad" | "neutral" {
  if (rank === null) return "neutral";
  if (rank <= 3) return "good";
  if (rank <= 10) return "warn";
  return "bad";
}

export function Empty({ icon, title, sub, action }: { icon: ReactNode; title: string; sub: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center py-16 text-center">
      <div className="mb-3 text-subtle">{icon}</div>
      <div className="font-medium">{title}</div>
      <p className="mt-1 max-w-sm text-[13px] text-muted">{sub}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

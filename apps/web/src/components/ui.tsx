import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEventHandler,
  type KeyboardEvent,
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowUp, Check, ChevronRight, Plus, Search, Upload, X } from "lucide-react";
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
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-[background-color,border-color,color,opacity,transform] duration-150 not-disabled:active:scale-[0.97] disabled:opacity-50",
        size === "sm" ? "h-7 rounded-md px-2.5 text-[13px] pointer-coarse:h-9" : "h-9 px-3.5 text-[13.5px] pointer-coarse:h-10",
        variant === "primary" && "bg-ink text-on-ink shadow-control hover:opacity-85",
        variant === "accent" && "bg-accent text-white hover:opacity-90",
        variant === "secondary" && "border border-line bg-surface text-fg shadow-control hover:border-line-strong hover:bg-hover",
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

/** The action that starts something new ("New role", "Add document"): a primary button with a plus. Not for a form's own submit. */
export function NewButton({ size = "md", ...rest }: Omit<BtnProps, "icon">) {
  return <Button variant="primary" size={size} icon={<Plus size={size === "sm" ? 13 : 14} />} {...rest} />;
}

/**
 * A side panel's or form's closing pair: Cancel (secondary) beside the one action that does the work (primary), with an
 * optional note on the left ("6 of 20 on your plan"). The action submits the form around it, or calls `onAction` when
 * there's no form.
 */
export function FormFooter({
  action,
  onCancel,
  onAction,
  disabled,
  note,
  cancel = "Cancel",
}: {
  action: ReactNode;
  onCancel: () => void;
  onAction?: () => void;
  disabled?: boolean;
  note?: ReactNode;
  cancel?: string;
}) {
  return (
    <>
      {note && <span className="mr-auto text-[12.5px] text-muted">{note}</span>}
      <Button type="button" onClick={onCancel}>
        {cancel}
      </Button>
      <Button type={onAction ? "button" : "submit"} variant="primary" onClick={onAction} disabled={disabled}>
        {action}
      </Button>
    </>
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

// ---------- Settings ----------

/** A settings page's sections, in one card divided by hairlines. */
export function SettingsSections({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card pad={false} className={cn("divide-y divide-line", className)}>
      {children}
    </Card>
  );
}

/**
 * One section of a settings page: what it is and why on the left with its one action under that, what's set on the
 * right. On a phone the action sits beside the title and what's set follows. Its action is secondary (`Change`), or
 * `danger` when it removes something; primary is kept for the page's own action and a form's submit.
 */
export function SettingsSection({
  title,
  sub,
  action,
  children,
}: {
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="grid gap-x-10 gap-y-4 p-5 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      <div className="flex items-start justify-between gap-4 md:flex-col md:justify-start">
        <div className="min-w-0">
          <h2 className="text-[14px] font-medium">{title}</h2>
          {sub && <p className="mt-1 text-[12.5px] leading-normal text-muted">{sub}</p>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
      </div>
      {children && <div className="min-w-0">{children}</div>}
    </section>
  );
}

/** What's set, a label beside each value. Use `Fact` for each pair. */
export function Facts({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-x-5 gap-y-3 text-[13.5px] sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)]">
      {children}
    </dl>
  );
}

export function Fact({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 wrap-break-word">{children}</dd>
    </>
  );
}

/** A person's initials in a circle. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-hover text-[12px] font-medium", className)} aria-hidden>
      {initials}
    </span>
  );
}

/** One row of a list inside `<Card pad={false}>`: something to recognise it by, two lines of text, and its controls. */
export function ItemRow({
  leading,
  title,
  sub,
  children,
}: {
  leading?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  /** The row's controls, at its end. */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 last:border-0">
      {leading}
      <div className="min-w-0 flex-1 basis-40">
        <div className="flex flex-wrap items-center gap-2 text-[14px]">{title}</div>
        {sub && <div className="truncate text-[12.5px] text-muted">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

/** A thing in a list of cards: its name with badges and a short fact, what it is, any detail below, and its actions. */
export function ItemCard({
  title,
  badges,
  meta,
  description,
  actions,
  children,
}: {
  title: ReactNode;
  badges?: ReactNode;
  meta?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Detail under the description. */
  children?: ReactNode;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <div className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
            {title}
            {badges}
            {meta && <span className="text-[12.5px] font-normal text-muted">{meta}</span>}
          </div>
          {description && <p className="mt-0.5 text-[12.5px] text-muted">{description}</p>}
          {children}
        </div>
        {actions && <div className="flex gap-1.5">{actions}</div>}
      </div>
    </Card>
  );
}

/** A row that opens to show more, with a control of its own that doesn't open it. Stack them in a bordered, divided box. */
export function Disclosure({
  label,
  note,
  control,
  children,
}: {
  label: ReactNode;
  note?: ReactNode;
  control?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-w-0 flex-1 basis-32 items-center gap-1.5 text-left text-[13.5px] font-medium"
        >
          <ChevronRight size={14} className={cn("shrink-0 text-subtle transition-transform duration-150", open && "rotate-90")} />
          {label}
          {note && <span className="text-[12px] font-normal text-muted">· {note}</span>}
        </button>
        {control}
      </div>
      {open && <div className="space-y-1 bg-bg px-3 pt-1 pb-3">{children}</div>}
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
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium leading-4", toneCls[tone], className)}
    >
      {children}
    </span>
  );
}

export function Dot({ tone }: { tone: Tone }) {
  const c = { neutral: "bg-subtle", good: "bg-good", bad: "bg-bad", warn: "bg-warn", info: "bg-info", accent: "bg-accent" }[tone];
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", c)} aria-hidden />;
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
      <div className="text-[12.5px] text-muted" title={hint}>
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="num font-serif text-[30px] leading-none tracking-tight">{value}</span>
        {delta}
      </div>
    </div>
  );
}

/** One step back up from a deep page; the last step is the page itself, so it has no link. */
export type Crumb = { label: ReactNode; to?: string };

/** The way back up from a deep page: Section › Item › This page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex min-w-0 items-center gap-1">
              {c.to && !last ? (
                <Link to={c.to} className="truncate underline-offset-2 hover:text-fg hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={cn("truncate", last && "text-fg")}>
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight size={13} className="shrink-0 text-subtle" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  sub,
  actions,
  crumbs,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  crumbs?: ReactNode;
}) {
  return (
    <div className="mb-7">
      {crumbs && <div className="mb-3 text-[13px] text-muted">{crumbs}</div>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        {/* A long title (a question) wraps in the space the actions leave, rather than pushing them to a row of their own. */}
        <div className="min-w-0 flex-1 basis-[20rem]">
          <h1 className="font-serif text-[34px] leading-[1.1] tracking-[-0.02em] text-balance">{title}</h1>
          {sub && <p className="mt-1.5 max-w-2xl text-[14px] text-muted">{sub}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** The row in a page's own navigation, the app's sidebar and the Settings and Admin rails alike. */
export const navRow = (active: boolean) =>
  cn(
    "flex h-7 shrink-0 items-center gap-2.5 rounded-md px-2 text-[13px] whitespace-nowrap transition-colors pointer-coarse:h-9",
    active ? "bg-active font-medium text-fg" : "text-muted hover:bg-hover hover:text-fg",
  );

/** Holds RailGroups: the side rail of a page with sections. Wide screens only; phones use MenuGroups on a list page. */
export const railGroups = "hidden lg:sticky lg:top-6 lg:flex lg:flex-col lg:gap-6 lg:self-start";

/** A titled group of navRows in a rail. */
export function RailGroup({ title, hint, children }: { title: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-px">
      <div className="px-2 pb-1">
        <div className="truncate text-[11px] font-medium tracking-[0.06em] text-subtle uppercase">{title}</div>
        {hint && <div className="text-[11.5px] leading-snug text-subtle">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

/** A titled group of MenuLinks: the phone's version of a RailGroup, one section per row. Stack them with space between. */
export function MenuGroup({ title, hint, children }: { title: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h2 className="truncate px-1 text-[11px] font-medium tracking-[0.06em] text-subtle uppercase">{title}</h2>
      {hint && <p className="px-1 pb-2 text-[12px] leading-snug text-subtle">{hint}</p>}
      <div className="mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-card">{children}</div>
    </section>
  );
}

/** One row of a MenuGroup: an icon, a name, and a chevron saying it opens a page. */
export function MenuLink({ to, icon, children }: { to: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex min-h-11 items-center gap-3 border-b border-line px-4 text-[14px] transition-colors last:border-0 hover:bg-hover active:bg-active"
    >
      {icon && <span className="flex shrink-0 text-muted">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <ChevronRight size={15} className="shrink-0 text-subtle" />
    </Link>
  );
}

/** Arrow keys move through a tab list or radio group and select what they land on; Tab leaves the group. */
function arrowKeys<T extends string>(ids: T[], value: T, onChange: (v: T) => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = (ids.indexOf(value) + step + ids.length) % ids.length;
    onChange(ids[next]!);
    e.currentTarget.querySelectorAll("button")[next]?.focus();
  };
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: ReactNode; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="tablist"
      onKeyDown={arrowKeys(
        tabs.map((t) => t.id),
        value,
        onChange,
      )}
      className="flex gap-5 overflow-x-auto border-b border-line"
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          tabIndex={value === t.id ? 0 : -1}
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

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled,
}: {
  options: { id: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
  /** Shows the choice without letting it change. */
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled}
      onKeyDown={
        disabled
          ? undefined
          : arrowKeys(
              options.map((o) => o.id),
              value,
              onChange,
            )
      }
      className="inline-flex max-w-full overflow-x-auto rounded-lg bg-hover p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          tabIndex={value === o.id ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(o.id)}
          className={cn(
            "h-7 shrink-0 rounded-md px-2.5 text-[13px] transition-colors pointer-coarse:h-9",
            value === o.id ? "bg-surface font-medium text-fg shadow-sm" : "text-muted not-disabled:hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** One choice from a few, shown as a row of cards. For a choice worth more room than Segmented gives it. */
export function ChoiceCards<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: ReactNode; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={arrowKeys(
        options.map((o) => o.id),
        value,
        onChange,
      )}
      className="grid max-w-3xl gap-3 sm:grid-cols-3"
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          tabIndex={value === o.id ? 0 : -1}
          onClick={() => onChange(o.id)}
          className={cn(
            "flex items-center gap-2.5 rounded-xl border bg-surface p-4 text-left text-[14px] shadow-control transition-colors",
            value === o.id ? "border-ink" : "border-line hover:border-line-strong",
          )}
        >
          {o.icon && <span className="flex shrink-0 text-muted">{o.icon}</span>}
          <span className="flex-1">{o.label}</span>
          {value === o.id && <Check size={14} />}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors pointer-coarse:after:absolute pointer-coarse:after:-inset-3",
        checked ? "bg-ink" : "bg-line-strong",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-4 rounded-full bg-surface shadow-sm transition-transform",
          checked && "translate-x-4",
        )}
      />
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
const fieldBase =
  "w-full rounded-lg border border-line bg-surface text-[13.5px] text-fg outline-none transition-[border-color,box-shadow] placeholder:text-subtle hover:border-line-strong focus:border-ring focus:ring-[3px] focus:ring-ring/20 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20 disabled:opacity-70";
const fieldSizes: Record<FieldSize, string> = {
  xs: "h-7 rounded-md px-2 text-[12.5px] pointer-coarse:h-9",
  sm: "h-8 px-2.5 text-[13px] pointer-coarse:h-9",
  md: "h-9 px-3 pointer-coarse:h-10",
  lg: "h-10 px-3",
};
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
  return <select {...rest} className={fieldClass(size, cn("select-field pr-7", className))} />;
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean; ref?: Ref<HTMLTextAreaElement> };
export function Textarea({ mono, className, ...rest }: TextareaProps) {
  return (
    <textarea
      {...rest}
      className={cn(fieldBase, "resize-y p-3 leading-[1.55]", mono && "font-mono text-[12.5px] leading-[1.6]", className)}
    />
  );
}

/** The text above a field. On its own, for a group of buttons that isn't a single input. */
export function FieldLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("mb-1.5 block text-[12.5px] font-medium text-muted", className)}>{children}</span>;
}

/** A label above a field, with an optional hint below it. */
export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <FieldLabel>{label}</FieldLabel>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-subtle">{hint}</span>}
    </label>
  );
}

/**
 * The file picker: one slim row the height of a field. It wraps a real, visually hidden <input type="file">, so the
 * keyboard, screen readers and form validation behave as they do for a native one. Drop a file on it too.
 * The only way to take a file anywhere in the app; never the browser's own button.
 */
export function FileInput({
  file,
  onChange,
  accept,
  required,
  hint,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  required?: boolean;
  /** What is accepted, under the row: "PDF, Markdown, HTML or text." */
  hint?: ReactNode;
}) {
  const hintId = useId();
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const take = (f: File | null) => {
    onChange(f);
    // A cleared state must clear the input too, or the same file can't be chosen twice in a row.
    if (!f && input.current) input.current.value = "";
  };
  return (
    <>
      <span
        onDragOver={(e) => (e.preventDefault(), setOver(true))}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files[0] ?? null);
        }}
        className={cn(
          "relative flex min-h-10 items-center gap-2.5 rounded-[10px] border border-dashed bg-bg py-1 pr-3 pl-1 transition-colors pointer-coarse:min-h-11",
          "border-line-strong hover:border-fg hover:bg-hover focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20",
          file && "border-solid",
          over && "border-fg bg-hover",
        )}
      >
        <input
          ref={input}
          type="file"
          required={required}
          accept={accept}
          aria-describedby={hint ? hintId : undefined}
          onChange={(e) => take(e.target.files?.[0] ?? null)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
        <span
          aria-hidden
          className="pointer-events-none inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[12.5px] font-medium shadow-control"
        >
          <Upload size={13} />
          {file ? "Change file" : "Choose file"}
        </span>
        <span className="pointer-events-none min-w-0 flex-1 truncate text-[13px] text-muted">
          {file ? (
            <>
              <b className="mr-1.5 font-medium text-fg">{file.name}</b>
              {Math.max(1, Math.round(file.size / 1024))} KB
            </>
          ) : (
            "or drop one here"
          )}
        </span>
      </span>
      {hint && (
        <span id={hintId} className="mt-1 block text-[12px] text-subtle">
          {hint}
        </span>
      )}
    </>
  );
}

/** A plain note that isn't a result: how something works, why a screen is empty. Never for a success or an error. */
export function Callout({ children }: { children: ReactNode }) {
  return <p className="rounded-[10px] bg-hover px-3 py-2 text-[13px] text-muted">{children}</p>;
}

export function Progress({
  value,
  tone = "ink",
  className,
}: {
  value: number;
  tone?: "ink" | "good" | "warn" | "bad" | "accent" | "info";
  className?: string;
}) {
  const c = { ink: "bg-ink", good: "bg-good", warn: "bg-warn", bad: "bg-bad", accent: "bg-accent", info: "bg-info" }[tone];
  return (
    <div
      className={cn("h-1.5 overflow-hidden rounded-full bg-hover", className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", c)} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

// ---------- Overlays ----------

/** What a dialog focuses when it opens. Without one, the dialog itself takes focus, not its close button. */
const firstField = "input:not([type=hidden],:disabled), textarea:not(:disabled), select:not(:disabled)";

/**
 * A native modal <dialog>, mounted only while it's open. The browser keeps focus inside, makes the page and the chat
 * widget behind it inert, draws it above both, and returns focus to whatever opened it.
 */
export function ModalDialog({
  onClose,
  label,
  labelledBy,
  className,
  style,
  children,
}: {
  onClose: () => void;
  label?: string;
  labelledBy?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    (dialog.querySelector<HTMLElement>(firstField) ?? dialog).focus();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      tabIndex={-1}
      aria-label={label}
      aria-labelledby={labelledBy}
      style={style}
      className={cn("overlay m-0 bg-surface text-fg outline-none", className)}
      // The caller decides whether to close: a Role with unsaved changes asks first.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // On press, not click: dragging a text selection out of a field must not close the panel.
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return;
        // Otherwise the press blurs the opener's restored focus onto the page.
        e.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  );
}

/**
 * The panel every form opens in, from the right edge of the page. Pass `onSubmit` and the body and footer become one
 * form, so `type="submit"` in the footer stays at the bottom of the panel and Enter still works.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  feedback,
  onSubmit,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** A `<Feedback>` for the panel's actions. It sits in the footer, above the buttons, so it is never scrolled out of sight. */
  feedback?: ReactNode;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  width?: number;
}) {
  const titleId = useId();
  if (!open) return null;
  const content = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">{children}</div>
      {(footer || feedback) && (
        <div className="shrink-0 space-y-2 border-t border-line px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {feedback}
          {footer && <div className="flex flex-wrap items-center justify-end gap-2">{footer}</div>}
        </div>
      )}
    </>
  );
  const fill = "flex min-h-0 flex-1 flex-col";
  return (
    <ModalDialog
      onClose={onClose}
      labelledBy={titleId}
      style={{ maxWidth: width }}
      className="anim-slide fixed inset-y-0 right-0 left-auto h-dvh max-h-none w-full border-l border-line shadow-float"
    >
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line py-3.5 pr-4 pl-6">
          <h2 id={titleId} className="min-w-0 truncate font-serif text-[22px] leading-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-hover hover:text-fg pointer-coarse:size-10"
          >
            <X size={16} />
          </button>
        </div>
        {onSubmit ? (
          <form onSubmit={onSubmit} className={fill}>
            {content}
          </form>
        ) : (
          <div className={fill}>{content}</div>
        )}
      </div>
    </ModalDialog>
  );
}

// ---------- Charts ----------

export function Sparkline({
  data,
  width = 72,
  height = 22,
  invert = false,
  tone,
}: {
  data: (number | null)[];
  width?: number;
  height?: number;
  invert?: boolean;
  tone?: "good" | "bad" | "muted";
}) {
  const vals = data.filter((d): d is number => d !== null);
  if (vals.length < 2) return <span className="text-subtle">—</span>;
  const min = Math.min(...vals),
    max = Math.max(...vals);
  const span = max - min || 1;
  const pts = data
    .map((d, i) =>
      d === null
        ? null
        : `${(i / (data.length - 1)) * width},${invert ? ((d - min) / span) * (height - 4) + 2 : height - 2 - ((d - min) / span) * (height - 4)}`,
    )
    .filter(Boolean)
    .join(" ");
  const first = vals[0]!,
    last = vals[vals.length - 1]!;
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
export function LineChart({
  labels,
  series,
  height = 220,
  invert = false,
  yMax,
  area = false,
  format = (v: number) => String(v),
}: {
  labels: string[];
  series: Series[];
  height?: number;
  invert?: boolean;
  yMax?: number;
  area?: boolean;
  format?: (v: number) => string;
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 640,
    H = height,
    pl = 36,
    pr = 12,
    pt = 12,
    pb = 26;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const lo = invert ? 1 : Math.min(0, ...all);
  const hi = yMax ?? Math.ceil(Math.max(...all) * (invert ? 1.1 : 1.15));
  const x = (i: number) => pl + (i / Math.max(1, labels.length - 1)) * (W - pl - pr);
  const y = (v: number) => (invert ? pt + ((v - lo) / (hi - lo)) * (H - pt - pb) : H - pb - ((v - lo) / (hi - lo)) * (H - pt - pb));
  const ticks = Array.from({ length: 5 }, (_, i) => Math.round(lo + ((hi - lo) * i) / 4));
  const step = Math.ceil(labels.length / 6);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={series.map((s) => s.name).join(", ") + " chart"}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray="2 4" />
            <text x={pl - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--subtle)" className="num">
              {format(t)}
            </text>
          </g>
        ))}
        {labels.map(
          (l, i) =>
            i % step === 0 && (
              <text key={l + i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--subtle)">
                {l}
              </text>
            ),
        )}
        {series.map((s, si) => {
          const pts = s.values
            .map((v, i) => (v === null ? null : ([x(i), y(v)] as const)))
            .filter((p): p is readonly [number, number] => p !== null);
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
                  <path d={`${d} L${pts[pts.length - 1]![0]},${H - pb} L${pts[0]![0]},${H - pb} Z`} fill={`url(#${id}-g)`} />
                </>
              )}
              <path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={1.75}
                strokeDasharray={s.dashed ? "4 4" : undefined}
                strokeLinejoin="round"
              />
            </g>
          );
        })}
        {labels.map((_, i) => (
          <rect
            key={i}
            x={x(i) - (W - pl - pr) / labels.length / 2}
            y={pt}
            width={(W - pl - pr) / labels.length}
            height={H - pt - pb}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={pt} y2={H - pb} stroke="var(--border-strong)" />
            {series.map(
              (s) =>
                s.values[hover] !== null && (
                  <circle
                    key={s.name}
                    cx={x(hover)}
                    cy={y(s.values[hover]!)}
                    r={3.5}
                    fill="var(--surface)"
                    stroke={s.color}
                    strokeWidth={2}
                  />
                ),
            )}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-sm"
          style={{ left: `min(calc(${(x(hover) / W) * 100}% + 8px), calc(100% - 140px))` }}
        >
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

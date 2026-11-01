import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowRight, Check } from "lucide-react";
import { SAMPLE_CONTENT } from "../data/site";

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Page column with Chatwoot-style hairline rails on wide screens. */
export function Container({ children, className, rails = false }: { children: ReactNode; className?: string; rails?: boolean }) {
  return (
    <div className={cn("mx-auto w-full max-w-[1200px] px-4 sm:px-6", rails && "xl:border-x xl:border-line", className)}>{children}</div>
  );
}

export function Section({ children, className, id, rails = true }: { children: ReactNode; className?: string; id?: string; rails?: boolean }) {
  return (
    <section id={id} className={cn("relative", className)}>
      <Container rails={rails} className="py-16 sm:py-20">{children}</Container>
    </section>
  );
}

/** Notched label above a section heading. */
export function Tag({ icon, children, tone = "ink" }: { icon?: ReactNode; children: ReactNode; tone?: "ink" | "accent" }) {
  return (
    <span className={cn("tag inline-flex w-fit items-center gap-1.5 py-1 pl-2.5 text-[13px] font-medium",
      tone === "ink" ? "bg-ink text-on-ink" : "bg-accent-soft text-accent")}>
      {icon}
      {children}
    </span>
  );
}

/** Origami-style heading: an ink line and a muted second line. */
export function Heading({ tag, title, muted, sub, center = false, as: H = "h2", size = "lg" }: { tag?: ReactNode; title: ReactNode; muted?: ReactNode; sub?: ReactNode; center?: boolean; as?: "h1" | "h2"; size?: "xl" | "lg" | "md" }) {
  return (
    <div className={cn("flex flex-col gap-3", center && "items-center text-center")}>
      {tag}
      <H className={cn("font-display leading-[0.95]",
        size === "xl" ? "text-[40px] sm:text-[52px] lg:text-[60px]" : size === "lg" ? "text-[32px] sm:text-[42px]" : "text-[26px] sm:text-[32px]")}>
        {title}
        {muted && <><br /><span className="text-muted">{muted}</span></>}
      </H>
      {sub && <p className={cn("mt-1 max-w-[58ch] text-[17px] leading-[1.6] text-fg/70 text-pretty", center && "mx-auto")}>{sub}</p>}
    </div>
  );
}

type BtnProps = { to?: string; href?: string; onClick?: () => void; children: ReactNode; variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "lg"; arrow?: boolean; className?: string; type?: "button" | "submit" };

export function Button({ to, href, onClick, children, variant = "primary", size = "md", arrow, className, type = "button" }: BtnProps) {
  const cls = cn(
    "group inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors duration-150",
    size === "lg" ? "h-12 px-5 text-[16px]" : size === "sm" ? "h-8 px-3 text-[14px]" : "h-10 px-4 text-[15px]",
    variant === "primary" && "bg-ink text-on-ink shadow-card hover:opacity-85",
    variant === "secondary" && "border border-line bg-surface text-fg shadow-card hover:border-line-strong",
    variant === "ghost" && "text-fg hover:bg-hover",
    className,
  );
  const inner = <>{children}{arrow && <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />}</>;
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  if (href) return <a href={href} className={cls}>{inner}</a>;
  return <button type={type} onClick={onClick} className={cls}>{inner}</button>;
}

export function CheckList({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-2.5", className)}>
      {items.map((t) => (
        <li key={t} className="flex gap-2.5 text-[15px]"><Check size={18} className="mt-0.5 shrink-0 text-good" />{t}</li>
      ))}
    </ul>
  );
}

/** Marks illustrative customer content while SAMPLE_CONTENT is on. */
export function SampleBadge({ className }: { className?: string }) {
  if (!SAMPLE_CONTENT) return null;
  return <span className={cn("inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-dashed border-line-strong px-2 py-0.5 text-[11.5px] font-medium text-muted", className)} title="Illustrative example, not a real customer">Sample story</span>;
}

export function PixelBand({ className }: { className?: string }) {
  return <div aria-hidden className={cn("pixel-band h-10", className)} />;
}

/** Hairline-divided strip of figures, the Origami stats row. */
export function StatStrip({ items }: { items: { value: string; label: ReactNode }[] }) {
  return (
    <div className="grid border-y border-line sm:grid-cols-2 lg:grid-cols-4">
      {items.map((s, i) => (
        <div key={i} className={cn("flex flex-col gap-2 px-6 py-8", i > 0 && "border-t border-line sm:border-t-0", i % 2 === 1 && "sm:border-l", i >= 2 && "sm:border-t lg:border-t-0", i > 0 && "lg:border-l")}>
          <span className="num font-display text-[44px] leading-none">{s.value}</span>
          <span className="text-[15px] text-muted">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

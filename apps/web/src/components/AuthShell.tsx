// The frame around sign-in, sign-up and the other account pages: the brand, the form, and a line below it.
// With `aside` (sign-in, sign-up and the first Organization, when the SEO module is on) wide screens split in two:
// the form on the left, and on the right the dark panel people know from the marketing site (AuthAside).
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Globe } from "lucide-react";
import { Logo } from "./Logo";
import { AuthAside, AuthProofCompact } from "./AuthAside";

type Props = { title: string; sub?: ReactNode; children: ReactNode; below?: ReactNode; aside?: boolean };

export function AuthShell({ title, sub, children, below, aside = false }: Props) {
  if (aside && __MODULE_SEO__)
    return (
      <div className="grid min-h-full gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
        <div className="relative flex flex-col px-3 py-5 sm:px-8">
          <Link to="/" className="w-fit">
            <Logo size={24} />
          </Link>
          <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">
            <h1 className="font-display text-[32px] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">{title}</h1>
            {sub && <p className="mt-2 text-[15px] leading-[1.55] text-muted">{sub}</p>}
            <div className="mt-8">{children}</div>
            {below && <p className="mt-8 text-[13.5px] text-muted">{below}</p>}
            <AuthProofCompact />
          </div>
        </div>
        <AuthAside />
      </div>
    );
  return (
    <div className="relative grid min-h-full place-items-center px-4 py-12">
      <div aria-hidden className="grid-backdrop pointer-events-none absolute inset-x-0 top-0 h-[520px]" />
      <div className="relative w-full max-w-[400px]">
        <div className="mb-8 flex justify-center">
          <Link to="/">
            <Logo size={24} />
          </Link>
        </div>
        <div className="rounded-2xl bg-surface p-7 shadow-float dark:ring-1 dark:ring-line">
          <h1 className="font-serif text-[26px] leading-tight tracking-[-0.02em]">{title}</h1>
          {sub && <p className="mt-1.5 text-[13.5px] text-muted">{sub}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {below && <p className="mt-5 text-center text-[13px] text-muted">{below}</p>}
      </div>
    </div>
  );
}

/** The website someone typed on the marketing site, shown above the form, with a way to drop it. */
export function SiteNote({ site, onDrop, children }: { site: string; onDrop?: () => void; children: ReactNode }) {
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 text-[13.5px] shadow-card">
      <Globe size={18} className="shrink-0 text-accent" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col text-muted">
        {children}
        <span className="truncate font-medium text-fg">{site}</span>
      </span>
      {onDrop && (
        <button
          type="button"
          onClick={onDrop}
          className="shrink-0 text-[12.5px] text-muted underline-offset-2 hover:text-fg hover:underline"
        >
          Remove
        </button>
      )}
    </div>
  );
}

// The frame around sign-in, sign-up and the other account pages: the brand, a card, and a line below it.
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Logo } from "./Logo";

export function AuthShell({ title, sub, children, below }: { title: string; sub?: ReactNode; children: ReactNode; below?: ReactNode }) {
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

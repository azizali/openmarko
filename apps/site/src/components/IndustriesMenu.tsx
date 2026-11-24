// The header's Industries menu, on wide screens: a panel under the header with every industry by group, and a side
// card for agencies and chains with the way to the full list. Opens on hover (with a short grace period, so the
// pointer can cross the gap) or on click; Escape, a click outside, or following a link closes it.
import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Container, cn } from "./ui";
import { groups, inGroup, menuColumns } from "../data/industries";

export function IndustriesMenu() {
  const loc = useLocation();
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const timer = useRef<number>(0);
  // Open on one path; any navigation closes it, as the mobile menu does.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === loc.pathname;
  const setOpen = (on: boolean) => {
    window.clearTimeout(timer.current);
    setOpenAt(on ? loc.pathname : null);
  };
  const closeSoon = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpenAt(null), 150);
  };
  const active = loc.pathname === "/for" || loc.pathname.startsWith("/for/");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpenAt(null);
      trigger.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpenAt(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const agencies = groups.find((g) => g.id === "agencies")!;
  return (
    <div
      ref={root}
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && closeSoon()}
    >
      <button
        ref={trigger}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[14px]",
          open || active ? "text-fg" : "text-muted hover:text-fg",
        )}
      >
        Industries
        <ChevronDown size={14} className={cn("transition-transform duration-200 ease-[var(--ease-out)]", open && "rotate-180")} />
      </button>
      {open && (
        // Hangs from the header's bottom edge, full width; the header is the positioned ancestor.
        <div id={panelId} className="rise absolute inset-x-0 top-full border-b border-line bg-bg shadow-float">
          <Container className="grid grid-cols-[repeat(4,1fr)_280px] gap-8 py-8">
            {menuColumns.map((col) => (
              <div key={col.join()} className="flex flex-col gap-7">
                {col.map((id) => {
                  const g = groups.find((x) => x.id === id)!;
                  return (
                    <div key={id}>
                      <div className="mb-2 flex items-center gap-2 text-[12px] font-medium tracking-wide text-subtle uppercase">
                        <g.icon size={14} className="text-accent" />
                        {g.label}
                      </div>
                      <ul className="flex flex-col">
                        {inGroup(id).map((ind) => (
                          <li key={ind.slug}>
                            <Link
                              to={`/for/${ind.slug}`}
                              className="-mx-2 flex min-h-8 items-center rounded-md px-2 text-[14px] text-fg/80 hover:bg-hover hover:text-fg"
                            >
                              {ind.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="flex flex-col gap-5 rounded-xl border border-line bg-sunken p-5">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[12px] font-medium tracking-wide text-subtle uppercase">
                  <agencies.icon size={14} className="text-accent" />
                  {agencies.label}
                </div>
                <ul className="flex flex-col gap-1">
                  {inGroup("agencies").map((ind) => (
                    <li key={ind.slug}>
                      <Link to={`/for/${ind.slug}`} className="group flex flex-col rounded-md py-1">
                        <span className="text-[14px] font-medium group-hover:underline group-hover:underline-offset-4">{ind.name}</span>
                        <span className="text-[13px] leading-[1.45] text-muted">{ind.pitch}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-auto border-t border-line pt-4">
                <p className="mb-3 text-[13px] leading-[1.5] text-muted">
                  Don't see yours? If customers find you on Google Maps, it works for you.
                </p>
                <Link to="/for" className="group inline-flex items-center gap-1.5 text-[14px] font-medium">
                  All industries
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </Container>
        </div>
      )}
    </div>
  );
}

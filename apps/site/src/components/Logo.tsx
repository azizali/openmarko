import { useId } from "react";
import { cn } from "./ui";
import { APP_NAME } from "../data/site";

/** A sun (the "O") over two uneven peaks (the "M"), filled with the brand sheen. Replace with your own mark. */
export function LogoMark({ size = 22, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cn("shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}-fill`} gradientUnits="userSpaceOnUse" x1="6.4" y1="0" x2="25.6" y2="32">
          <stop offset="0%" style={{ stopColor: "var(--sheen-b)" }} />
          <stop offset="100%" style={{ stopColor: "var(--sheen-a)" }} />
        </linearGradient>
      </defs>
      <g fill={`url(#${id}-fill)`}>
        <circle cx="16" cy="5.8" r="4.4" />
        <path d="M2 27 10 10l6 10 6-7 8 14Z" />
      </g>
    </svg>
  );
}

export function Logo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)} style={{ gap: size / 16 }}>
      <LogoMark size={size} />
      <span className="font-sans leading-none font-semibold tracking-[-0.03em]" style={{ fontSize: size * 0.86 }}>
        {APP_NAME}
      </span>
    </span>
  );
}

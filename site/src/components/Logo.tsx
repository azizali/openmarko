import { useId } from "react";
import { cn } from "./ui";

/** A solid circle (the "O") with a shallow wide V cut into the top (the middle of the "M"). Fills with the active flavor's sheen. */
export function LogoMark({ size = 22, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cn("shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" style={{ stopColor: "var(--sheen-b)" }} />
          <stop offset="100%" style={{ stopColor: "var(--sheen-a)" }} />
        </linearGradient>
        <mask id={`${id}-cut`}>
          <rect width="32" height="32" fill="white" />
          <path d="M8 0 16 10.5 24 0Z" fill="black" />
        </mask>
      </defs>
      <circle cx="16" cy="16" r="13" mask={`url(#${id}-cut)`} fill={`url(#${id}-fill)`} />
    </svg>
  );
}

export function Logo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <LogoMark size={size} />
      <span className="font-sans leading-none font-semibold tracking-[-0.03em]" style={{ fontSize: size * 0.86 }}>OpenMarko</span>
    </span>
  );
}

import { useId } from "react";
import { cn } from "./ui";

/** Droplet map pin with a big round "O"; a wide notch opens the O at the top so the shoulders read as the humps of an "M". Fills with the active flavor's sheen. */
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
          <circle cx="16" cy="13.4" r="5" fill="black" />
          <path d="M12.2 0 16 9.3 19.8 0Z" fill="black" />
        </mask>
      </defs>
      <path
        mask={`url(#${id}-cut)`}
        fill={`url(#${id}-fill)`}
        d="M16 2.5c-5.8 0-10.5 4.6-10.5 10.4 0 7.4 8.4 15.6 9.6 16.7.5.5 1.3.5 1.8 0 1.2-1.1 9.6-9.3 9.6-16.7C26.5 7.1 21.8 2.5 16 2.5Z"
      />
    </svg>
  );
}

export function Logo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <LogoMark size={size} />
      <span className="font-serif leading-none tracking-[-0.02em]" style={{ fontSize: size * 0.92 }}>OpenMarko</span>
    </span>
  );
}

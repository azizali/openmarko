/**
 * Every success and failure message in the app (ADR 0030). Two places, never the top of a page:
 *
 * 1. Beside the action. The person pressed a button that stays on screen, so the message goes in that button's own row:
 *    `const fb = useFeedback()`, then `<Feedback {...fb.props} />` next to the button.
 * 2. A toast. Nothing visible owns the action (a menu item, a toggle, copy, delete): `const toast = useToast()`.
 *
 * A page that couldn't load at all shows a `LoadError` where its content would be. Nothing else renders a message.
 */
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { cn } from "./ui";

type Tone = "good" | "bad";
export type Message = { id: number; tone: Tone; lead: string; text: string };

/** How long a success stays. An error stays until it is dismissed or the next attempt. */
const SUCCESS_MS = 5000;

let nextId = 0;
const make = (tone: Tone, lead: string, text: string): Message => ({ id: ++nextId, tone, lead, text });

/** Runs `onExpire` after a success has been on screen for a while; hovering or focusing the message pauses it. */
function useExpiry(message: Message | null, paused: boolean, onExpire: () => void) {
  useEffect(() => {
    if (!message || message.tone === "bad" || paused) return;
    const t = setTimeout(onExpire, SUCCESS_MS);
    return () => clearTimeout(t);
  }, [message, paused, onExpire]);
}

/**
 * The state behind a `<Feedback>`: one message at a time, replaced by the next.
 * Pass `resetOn` for a form that opens and closes (a panel's `open`): the message is cleared each time it changes,
 * so a failure never greets the next person who opens the panel.
 */
export function useFeedback(resetOn?: unknown) {
  const [message, setMessage] = useState<Message | null>(null);
  const [paused, setPaused] = useState(false);
  const clear = useCallback(() => setMessage(null), []);
  useEffect(() => setMessage(null), [resetOn]);
  useExpiry(message, paused, clear);
  return useMemo(
    () => ({
      /** Spread onto `<Feedback>`. */
      props: { message, onDismiss: clear, onPause: setPaused },
      /** `lead` is the short bold start ("Saved", "Invited a@b.co"); `text` is an optional second line. */
      succeed: (lead = "Saved", text = "") => setMessage(make("good", lead, text)),
      /** `text` is the reason and what to do. `lead` names what failed: "Could not save", "Could not disconnect". */
      fail: (text: string, lead = "Could not save") => setMessage(make("bad", lead, text)),
      clear,
    }),
    [message, clear],
  );
}

/**
 * The message itself. The live region is always in the page, empty, so a screen reader announces what is put into it.
 * Errors are `role="alert"`, successes `role="status"`. The icon and the lead-in carry the meaning along with colour.
 */
export function Feedback({
  message,
  onDismiss,
  onPause,
  className,
}: {
  message: Message | null;
  onDismiss: () => void;
  onPause?: (paused: boolean) => void;
  className?: string;
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true" // Empty, it takes no room (and no gap in a stack) but stays in the page, so a screen reader hears what arrives.
      className={cn("min-w-0 flex-1 empty:absolute", className)}
    >
      {message && <Bubble key={message.id} message={message} onDismiss={onDismiss} onPause={onPause} />}
    </div>
  );
}

function Bubble({
  message,
  onDismiss,
  onPause,
  raised,
}: {
  message: Message;
  onDismiss: () => void;
  onPause?: (paused: boolean) => void;
  raised?: boolean;
}) {
  const bad = message.tone === "bad";
  const Icon = bad ? CircleAlert : CircleCheck;
  return (
    <div
      role={bad ? "alert" : "status"}
      onMouseEnter={() => onPause?.(true)}
      onMouseLeave={() => onPause?.(false)}
      onFocus={() => onPause?.(true)}
      onBlur={() => onPause?.(false)}
      className={cn(
        "anim-fade flex items-start gap-2.5 rounded-[10px] px-3 py-2 text-[13px] leading-[1.45]",
        raised ? "border bg-surface text-fg shadow-float" : bad ? "bg-bad-soft text-bad" : "bg-good-soft text-good",
        raised && (bad ? "border-bad" : "border-line"),
      )}
    >
      <Icon size={16} aria-hidden className={cn("mt-px shrink-0", raised && (bad ? "text-bad" : "text-good"))} />
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <b className="font-medium">{message.lead}</b>
        {message.text && <span className={cn("block", raised && "text-muted")}>{message.text}</span>}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss message"
        className="-my-0.5 -mr-1 grid size-6 shrink-0 place-items-center rounded-md hover:bg-black/10 pointer-coarse:size-10 dark:hover:bg-white/10"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}

// ---------- Toasts ----------

type Toasts = { success: (lead: string, text?: string) => void; error: (text: string, lead?: string) => void };
const ToastContext = createContext<Toasts | null>(null);

/** Mounted once, at the root. Holds the toasts and their always-present live region. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Message[]>([]);
  const [paused, setPaused] = useState(false);
  const drop = useCallback((id: number) => setItems((l) => l.filter((m) => m.id !== id)), []);
  const api = useMemo<Toasts>(
    () => ({
      success: (lead, text = "") => setItems((l) => [...l.slice(-3), make("good", lead, text)]),
      error: (text, lead = "That didn't work") => setItems((l) => [...l.slice(-3), make("bad", lead, text)]),
    }),
    [],
  );
  return (
    <ToastContext value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] grid justify-items-center gap-2 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        {items.map((m) => (
          <Expiring key={m.id} message={m} paused={paused} onDrop={drop} onPause={setPaused} />
        ))}
      </div>
    </ToastContext>
  );
}

function Expiring({
  message,
  paused,
  onDrop,
  onPause,
}: {
  message: Message;
  paused: boolean;
  onDrop: (id: number) => void;
  onPause: (p: boolean) => void;
}) {
  const drop = useCallback(() => onDrop(message.id), [onDrop, message.id]);
  useExpiry(message, paused, drop);
  return (
    <div className="pointer-events-auto w-full max-w-[420px]">
      <Bubble message={message} onDismiss={drop} onPause={onPause} raised />
    </div>
  );
}

/** For an action nothing on screen owns: a menu item, a toggle, copy, delete. */
export function useToast(): Toasts {
  const t = use(ToastContext);
  if (!t) throw new Error("useToast needs a <ToastProvider> above it.");
  return t;
}

// ---------- A page that couldn't load ----------

/** Where a page's content would be, when the request for it failed. The only message allowed near the top. */
export function LoadError({ children, what = "this page" }: { children: ReactNode; what?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className="flex items-start gap-2.5 rounded-[10px] bg-bad-soft px-3 py-2 text-[13px] text-bad">
      <CircleAlert size={16} aria-hidden className="mt-px shrink-0" />
      <span>
        <b className="font-medium">Could not load {what}.</b> {children}
      </span>
    </p>
  );
}

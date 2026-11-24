// The chat UI: a floating button and a panel with past chats, a new chat and stop. The panel floats, docks to the
// side of the page (which makes room for it), or goes wide over most of the screen. The same UI serves two
// audiences through a ChatBackend: a website's anonymous visitors (widget.ts) and the app's signed-in members
// (apps/web, components/AppChat.tsx). It lives in a shadow DOM, so a page's styles can't break it and it can't break
// the page. No dependencies, so the embeddable script stays small.

export type Chat = { id: string; title: string };
export type Line = { role: "user" | "assistant"; text: string; sources?: string[]; tools?: ToolUse[] };
export type Reply = { onText: (delta: string) => void; onSources: (titles: string[]) => void; onTool?: (use: ToolUse) => void };

/**
 * A tool the assistant used while answering a member (ADR 0036): which one, how it went, and the Task it proposed,
 * if it proposed one. Website visitors' chats have none.
 */
export type ToolUse = {
  id: string;
  /** What it does, in words: `automation__recent_activity` reads "recent activity". */
  label: string;
  state: "running" | "done" | "failed";
  error?: string;
  task?: { id: string; title: string; applied: boolean };
};

/** A tool's call or result, as the stream or a saved message gives it, in the words the chat shows. */
export function toolUse(id: string, toolName: string, outcome: { output?: unknown; errorText?: string } | null): ToolUse {
  const label = (toolName.split("__")[1] ?? toolName).replaceAll("_", " ");
  if (!outcome) return { id, label, state: "running" };
  if (outcome.errorText !== undefined) return { id, label, state: "failed", error: outcome.errorText };
  const out = (outcome.output ?? {}) as { error?: { message?: string }; taskId?: string; title?: string; applied?: boolean };
  if (out.error) return { id, label, state: "failed", error: out.error.message ?? "It couldn't be done." };
  const task = typeof out.taskId === "string" ? { id: out.taskId, title: out.title ?? label, applied: !!out.applied } : undefined;
  return { id, label, state: "done", ...(task ? { task } : {}) };
}

/** Where chats come from and go to. Everything else about the widget is the same for every audience. */
export type ChatBackend = {
  /** Past chats, newest first. */
  list(): Promise<Chat[]>;
  lines(id: string): Promise<Line[]>;
  /** Makes the chat a first message goes into, and returns its id. */
  start(firstMessage: string): Promise<string>;
  send(id: string, text: string, reply: Reply, signal: AbortSignal): Promise<void>;
  remove(id: string): Promise<void>;
  /** Applies a Task a tool proposed. Without it, a proposed Task says where to apply it instead. */
  applyTask?(taskId: string): Promise<void>;
};

/** Thrown by a backend when a chat can't continue: the next message starts a new one. */
export class ChatExpired extends Error {}

export type ChatOptions = {
  backend: ChatBackend;
  name: string;
  greeting: string;
  maxLength: number;
  /** The floating button. Without it, something else opens the panel (setOpen). */
  launcher: boolean;
  /** Open the latest chat the first time the panel opens: a website's visitor moves between pages. */
  resume?: boolean;
  /** CSS for the `--cw-*` tokens below, set on the host element so it can refer to the page's own variables. */
  theme?: Record<string, string>;
  /** Called when the person opens or closes the panel from inside the widget. */
  onOpenChange?: (open: boolean) => void;
  /** Lay out inside the nearest positioned ancestor instead of the browser window: the preview in Widgets. */
  stage?: boolean;
  /** Start with the panel open, without taking focus from the page. */
  startOpen?: boolean;
};

/** What can change while the widget is on screen. */
export type ChatLook = Pick<ChatOptions, "name" | "greeting" | "theme">;

export type ChatHandle = {
  setOpen(open: boolean): void;
  setLauncher(show: boolean): void;
  configure(look: ChatLook): void;
  destroy(): void;
};

/** The tokens for an accent colour (#rrggbb): text on it is dark or light, whichever reads. */
export function accentTheme(accent: string): Record<string, string> {
  const channel = (at: number) => {
    const c = Number.parseInt(accent.slice(at, at + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return { "--cw-accent": accent, "--cw-on-accent": luminance > 0.4 ? "#18181b" : "#fff" };
}

const svg = (body: string) =>
  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const path = (...d: string[]) => svg(d.map((x) => `<path d="${x}"/>`).join(""));
const icons = {
  sparkle: path("M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z", "M19 3v4", "M21 5h-4"),
  history: path("M3 12a9 9 0 1 0 3-6.7L3 8", "M3 3v5h5", "M12 7v5l4 2"),
  plus: path("M12 5v14", "M5 12h14"),
  expand: path("M15 3h6v6", "M9 21H3v-6", "M21 3l-7 7", "M3 21l7-7"),
  collapse: path("M4 14h6v6", "M20 10h-6V4", "M14 10l7-7", "M3 21l7-7"),
  dock: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>'),
  undock: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><rect x="11" y="11" width="7" height="6" rx="1"/>'),
  close: path("M18 6 6 18", "M6 6l12 12"),
  down: path("M6 9l6 6 6-6"),
  back: path("M15 18l-6-6 6-6"),
  send: path("M12 19V5", "M5 12l7-7 7 7"),
  stop: svg('<rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none"/>'),
  trash: path("M3 6h18", "M8 6V4h8v2", "M19 6l-1 14H6L5 6"),
};

const css = `
:host {
  all: initial;
  --cw-bg: #fff; --cw-soft: #f4f4f5; --cw-line: #e4e4e7; --cw-text: #18181b; --cw-muted: #71717a;
  --cw-accent: #18181b; --cw-on-accent: #fff; --cw-bad: #c42b2b;
  --cw-dock: 420px; --cw-font: -apple-system, "Segoe UI", system-ui, sans-serif; --cw-z: 2147483000;
  font: 14px/1.5 var(--cw-font); color: var(--cw-text);
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
button:focus-visible, textarea:focus-visible { outline: 2px solid var(--cw-accent); outline-offset: 1px; }
.launch { position: fixed; right: 20px; bottom: 20px; z-index: var(--cw-z); display: grid; place-items: center; width: 52px; height: 52px; border-radius: 26px; background: var(--cw-accent); color: var(--cw-on-accent); box-shadow: 0 6px 20px rgba(0,0,0,.22); transition: transform .15s ease; }
.launch:hover { transform: scale(1.05); }
.launch:active { transform: scale(.97); }
.launch:not(.stage) { cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
.launch.dragging { cursor: grabbing; transform: scale(1.08); transition: none; }
.launch svg { width: 22px; height: 22px; }
.panel { position: fixed; right: 20px; bottom: 84px; z-index: var(--cw-z); display: flex; flex-direction: column; width: min(400px, calc(100vw - 40px)); height: min(600px, calc(100vh - 110px)); overflow: hidden; background: var(--cw-bg); border: 1px solid var(--cw-line); border-radius: 14px; box-shadow: 0 12px 40px rgba(0,0,0,.22); transform-origin: bottom right; animation: rise .16s ease-out; }
.panel.solo { bottom: 20px; height: min(600px, calc(100vh - 40px)); }
.panel.wide, .panel.wide.solo { inset: 0; margin: auto; width: min(1360px, calc(100vw - 48px)); height: calc(100dvh - 48px); transform-origin: center; box-shadow: 0 24px 80px rgba(0,0,0,.32); }
.panel.dock, .panel.dock.solo { top: 0; right: 0; bottom: 0; width: var(--cw-dock); height: 100dvh; border-width: 0 0 0 1px; border-radius: 0; box-shadow: none; animation: none; }
.launch.covered { display: none; }
.launch.stage { position: absolute; right: 16px; bottom: 16px; }
.panel.stage { position: absolute; right: 16px; bottom: 80px; width: calc(100% - 32px); max-width: 340px; height: calc(100% - 96px); max-height: 520px; }
.panel.stage.wide { inset: 8px; margin: 0; width: auto; max-width: none; height: auto; max-height: none; }
.panel.stage.dock { top: 0; right: 0; bottom: 0; width: 300px; max-width: 100%; height: 100%; max-height: none; }
@keyframes rise { from { opacity: 0; transform: translateY(6px) scale(.98); } }
header { display: flex; align-items: center; gap: 2px; min-height: 46px; padding: 0 8px 0 14px; border-bottom: 1px solid var(--cw-line); }
.title { flex: 1; min-width: 0; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.icon { display: grid; place-items: center; flex: none; width: 30px; height: 30px; border-radius: 7px; color: var(--cw-muted); }
.icon:hover { background: var(--cw-soft); color: var(--cw-text); }
.back { margin-left: -8px; }
.log { flex: 1; display: flex; flex-direction: column; gap: 10px; padding: 14px; overflow-y: auto; overscroll-behavior: contain; }
.wide .log > *, .wide form, .wide .notice { width: 100%; }
.wide .log { padding-inline: max(14px, calc((100% - 820px) / 2)); }
.wide form, .wide .notice { max-width: 848px; margin-inline: auto; }
.wide .msg { width: auto; max-width: 75%; }
.msg { max-width: 85%; padding: 8px 12px; border-radius: 13px; white-space: pre-wrap; overflow-wrap: anywhere; }
.user { align-self: flex-end; background: var(--cw-accent); color: var(--cw-on-accent); }
.assistant { align-self: flex-start; background: var(--cw-soft); }
.sources { margin-top: 5px; font-size: 12px; color: var(--cw-muted); }
.tools { display: grid; gap: 6px; margin-top: 6px; white-space: normal; }
.tool { font-size: 12px; color: var(--cw-muted); }
.tool.failed { color: var(--cw-bad); }
.task { display: grid; gap: 6px; padding: 9px 10px; background: var(--cw-bg); border: 1px solid var(--cw-line); border-radius: 10px; }
.task strong { font-weight: 600; }
.task span { font-size: 12px; color: var(--cw-muted); }
.task button { justify-self: start; padding: 4px 11px; font-size: 12.5px; font-weight: 600; border-radius: 7px; background: var(--cw-accent); color: var(--cw-on-accent); }
.task button:disabled { opacity: .6; cursor: default; }
.dots { display: inline-flex; gap: 3px; padding: 6px 0; }
.dots i { width: 5px; height: 5px; border-radius: 50%; background: var(--cw-muted); animation: pulse 1s infinite ease-in-out; }
.dots i:nth-child(2) { animation-delay: .15s; }
.dots i:nth-child(3) { animation-delay: .3s; }
@keyframes pulse { 0%, 100% { opacity: .3; } 50% { opacity: 1; } }
.history { flex: 1; margin: 0; padding: 6px; overflow-y: auto; overscroll-behavior: contain; list-style: none; }
.history li { display: flex; align-items: center; border-radius: 8px; }
.history li:hover, .history li.current { background: var(--cw-soft); }
.history .open { flex: 1; min-width: 0; padding: 9px 10px; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.history .icon { opacity: 0; margin-right: 3px; }
.history li:hover .icon, .history .icon:focus-visible { opacity: 1; }
@media (hover: none) { .history .icon { opacity: 1; } }
.empty { padding: 28px 12px; text-align: center; color: var(--cw-muted); }
.notice { padding: 0 14px 8px; font-size: 12.5px; color: var(--cw-bad); }
form { display: flex; align-items: flex-end; gap: 6px; margin: 0; padding: 0 10px 10px; }
textarea { flex: 1; min-width: 0; max-height: 140px; padding: 8px 11px; font: inherit; color: inherit; background: var(--cw-bg); border: 1px solid var(--cw-line); border-radius: 10px; outline: none; resize: none; }
textarea:focus { border-color: var(--cw-accent); }
textarea:focus-visible { outline: none; }
textarea::placeholder { color: var(--cw-muted); }
.go { display: grid; place-items: center; flex: none; width: 37px; height: 37px; border-radius: 10px; background: var(--cw-accent); color: var(--cw-on-accent); }
.go:disabled { opacity: .45; cursor: default; }
@media (max-width: 767px) { .panel:not(.stage) .dockit { display: none; } }
@media (max-width: 480px) {
  .panel:not(.stage), .panel.solo:not(.stage), .panel.wide:not(.stage), .panel.wide.solo:not(.stage), .panel.dock:not(.stage), .panel.dock.solo:not(.stage) { inset: auto 0 0 auto; margin: 0; width: 100vw; height: 100dvh; border: 0; border-radius: 0; }
  .launch.open:not(.stage), .panel:not(.stage) .expand { display: none; }
  textarea { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) { .panel, .launch, .dots i { animation: none; transition: none; } }
`;

const skeleton = `<style>${css}</style>
<button class="launch" type="button" aria-expanded="false"></button>
<section class="panel" role="dialog" hidden>
  <header>
    <button class="icon back" type="button" aria-label="Back to chat" hidden>${icons.back}</button>
    <div class="title"></div>
    <button class="icon past" type="button" aria-label="Past chats" title="Past chats">${icons.history}</button>
    <button class="icon new" type="button" aria-label="New chat" title="New chat">${icons.plus}</button>
    <button class="icon dockit" type="button"></button>
    <button class="icon expand" type="button"></button>
    <button class="icon shut" type="button" aria-label="Close" title="Close">${icons.close}</button>
  </header>
  <div class="log" aria-live="polite"></div>
  <ul class="history" hidden></ul>
  <div class="notice" role="alert" hidden></div>
  <form>
    <textarea rows="1" aria-label="Your message" placeholder="Ask a question…"></textarea>
    <button class="go" type="submit" aria-label="Send">${icons.send}</button>
  </form>
</section>`;

// ---------- Where the floating button sits ----------

/** Distances from the window's right and bottom edges: where the button is, and so where the panel opens. */
export type Pos = { right: number; bottom: number };
type View = { w: number; h: number };
const LAUNCHER_SIZE = 52;
const EDGE_GAP = 8;
const PANEL_GAP = 12;
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), Math.max(lo, hi));

/** Keeps the whole button on screen. */
export function clampLauncher(p: Pos, view: View): Pos {
  return {
    right: clamp(p.right, EDGE_GAP, view.w - LAUNCHER_SIZE - EDGE_GAP),
    bottom: clamp(p.bottom, EDGE_GAP, view.h - LAUNCHER_SIZE - EDGE_GAP),
  };
}

/**
 * Where the floating panel goes for a button at `p`: above it when there's room, else below, lined up with the
 * button's right edge unless that would push it off the left. From the default corner this is the CSS's own place.
 */
export function panelPlace(p: Pos, view: View): Pos & { width: number; height: number } {
  const width = Math.min(400, view.w - 40);
  const height = Math.min(600, view.h - 110);
  const above = p.bottom + LAUNCHER_SIZE + PANEL_GAP;
  const below = p.bottom - PANEL_GAP - height;
  const fitsAbove = view.h - above - height >= EDGE_GAP;
  return {
    right: clamp(p.right, EDGE_GAP, view.w - width - EDGE_GAP),
    bottom: fitsAbove ? above : below >= EDGE_GAP ? below : clamp(above, EDGE_GAP, view.h - height - EDGE_GAP),
    width,
    height,
  };
}

const POS_KEY = "app-chat:launcher";

/** Where someone left the button, on this browser. Null: the corner it starts in. */
function savedPos(): Pos | null {
  try {
    const v = JSON.parse(localStorage.getItem(POS_KEY) ?? "null") as Partial<Pos> | null;
    return v && Number.isFinite(v.right) && Number.isFinite(v.bottom) ? { right: v.right!, bottom: v.bottom! } : null;
  } catch {
    return null;
  }
}

type Layout = "float" | "dock" | "wide";
const LAYOUT_KEY = "app-chat:layout";

/** Docked is remembered, so the panel stays where someone put it. Wide is for the moment: it covers the page. */
function savedLayout(): Layout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === "dock" ? "dock" : "float";
  } catch {
    return "float";
  }
}

const historyNote = (text: string) => Object.assign(document.createElement("li"), { className: "empty", textContent: text });

const messageOf = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong.");

class ChatView implements ChatHandle {
  private root: ShadowRoot;
  private $ = <T extends HTMLElement>(selector: string) => this.root.querySelector(selector) as T;
  private launch: HTMLButtonElement;
  private panel: HTMLElement;
  private log: HTMLElement;
  private history: HTMLElement;
  private notice: HTMLElement;
  private input: HTMLTextAreaElement;
  private go: HTMLButtonElement;

  private open = false;
  private layout: Layout = "float";
  /** Tablets and up: below that the panel is the whole screen anyway, so the page keeps its width. */
  private roomy = window.matchMedia("(min-width: 768px)");
  private reserved: string | null = null;
  private onRoomChange = () => this.reserveRoom();
  /** Where the button was dragged to. Null: the corner it starts in. A phone's panel is the whole screen, wherever it is. */
  private pos: Pos | null = null;
  private phone = window.matchMedia("(max-width: 480px)");
  private onViewChange = () => this.placeLauncher();
  /** Set for the click a drag ends with, so letting go doesn't also open the panel. */
  private justDragged = false;
  private view: "chat" | "history" = "chat";
  private chatId: string | null = null;
  private lines: Line[] = [];
  private turn: AbortController | null = null;
  private resumed = false;
  /** Bumped whenever the chat on screen changes, so answers and loads for the previous one are ignored. */
  private seq = 0;

  constructor(
    private host: HTMLElement,
    private o: ChatOptions,
  ) {
    this.applyTheme();
    this.open = o.startOpen ?? false;
    this.layout = o.stage ? "float" : savedLayout();
    this.roomy.addEventListener("change", this.onRoomChange);
    this.pos = o.stage ? null : savedPos();
    this.phone.addEventListener("change", this.onViewChange);
    window.addEventListener("resize", this.onViewChange);
    this.root = host.attachShadow({ mode: "closed" });
    this.root.innerHTML = skeleton;
    this.launch = this.$(".launch");
    this.panel = this.$(".panel");
    this.log = this.$(".log");
    this.history = this.$(".history");
    this.notice = this.$(".notice");
    this.input = this.$("textarea");
    this.go = this.$(".go");

    this.input.maxLength = o.maxLength;
    this.launch.classList.toggle("stage", !!o.stage);
    this.panel.classList.toggle("stage", !!o.stage);
    this.setLauncher(o.launcher);
    this.sync();
    this.drawLog();
    if (!o.stage) this.makeDraggable();

    this.launch.addEventListener("click", () => {
      if (!this.justDragged) this.userSetOpen(!this.open);
    });
    this.$(".shut").addEventListener("click", () => this.userSetOpen(false));
    this.$(".expand").addEventListener("click", () => {
      this.setLayout("wide");
    });
    this.$(".dockit").addEventListener("click", () => this.setLayout("dock"));
    this.$(".new").addEventListener("click", () => this.newChat());
    this.$(".past").addEventListener("click", () => void this.showHistory());
    this.$(".back").addEventListener("click", () => this.showChat());
    this.panel.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (this.view === "history") this.showChat();
      else this.userSetOpen(false);
    });
    this.input.addEventListener("input", () => this.fitInput());
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        this.submit();
      }
    });
    this.$("form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.submit();
    });
    this.go.addEventListener("click", (e) => {
      if (!this.turn) return;
      e.preventDefault();
      this.turn.abort();
    });
  }

  setOpen(open: boolean) {
    if (open === this.open) return;
    this.open = open;
    this.sync();
    if (!open) return;
    this.focusInput();
    if (this.o.resume && !this.resumed) void this.resume();
    this.resumed = true;
  }

  setLauncher(show: boolean) {
    this.launch.hidden = !show;
    this.panel.classList.toggle("solo", !show);
    this.placeLauncher();
  }

  /** Drag the button anywhere on the page. A press that barely moves is still a click. */
  private makeDraggable() {
    const THRESHOLD = 6;
    let from: { x: number; y: number; at: Pos } | null = null;
    let moved = false;
    this.launch.title = "Drag to move";
    this.launch.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const r = this.launch.getBoundingClientRect();
      from = { x: e.clientX, y: e.clientY, at: { right: window.innerWidth - r.right, bottom: window.innerHeight - r.bottom } };
      moved = false;
      this.launch.setPointerCapture(e.pointerId);
    });
    this.launch.addEventListener("pointermove", (e) => {
      if (!from) return;
      const dx = e.clientX - from.x;
      const dy = e.clientY - from.y;
      if (!moved && Math.hypot(dx, dy) < THRESHOLD) return;
      moved = true;
      this.launch.classList.add("dragging");
      this.pos = { right: from.at.right - dx, bottom: from.at.bottom - dy };
      this.placeLauncher();
    });
    const end = () => {
      if (!from) return;
      from = null;
      this.launch.classList.remove("dragging");
      if (!moved) return;
      this.justDragged = true;
      setTimeout(() => (this.justDragged = false), 0); // the click that follows the release comes first
      try {
        if (this.pos) localStorage.setItem(POS_KEY, JSON.stringify(this.pos));
      } catch {
        // not remembered: it starts in its corner next time
      }
    };
    this.launch.addEventListener("pointerup", end);
    this.launch.addEventListener("pointercancel", end);
  }

  /** Puts the button where it was dragged (kept on screen), and the panel beside it. */
  private placeLauncher() {
    const s = this.launch.style;
    if (this.pos) this.pos = clampLauncher(this.pos, { w: window.innerWidth, h: window.innerHeight });
    s.right = this.pos ? `${this.pos.right}px` : "";
    s.bottom = this.pos ? `${this.pos.bottom}px` : "";
    this.placePanel();
  }

  private placePanel() {
    const s = this.panel.style;
    const beside = this.pos && this.layout === "float" && !this.launch.hidden && !this.phone.matches;
    if (!beside) {
      s.right = s.bottom = s.width = s.height = s.transformOrigin = "";
      return;
    }
    const place = panelPlace(this.pos!, { w: window.innerWidth, h: window.innerHeight });
    s.right = `${place.right}px`;
    s.bottom = `${place.bottom}px`;
    s.width = `${place.width}px`;
    s.height = `${place.height}px`;
    s.transformOrigin = `${place.bottom >= this.pos!.bottom ? "bottom" : "top"} ${place.right <= this.pos!.right ? "right" : "left"}`;
  }

  configure(look: ChatLook) {
    this.o = { ...this.o, ...look };
    this.applyTheme();
    this.sync();
    if (!this.lines.length && !this.chatId) this.drawLog();
  }

  destroy() {
    this.cancelTurn();
    this.open = false;
    this.reserveRoom();
    this.roomy.removeEventListener("change", this.onRoomChange);
    this.phone.removeEventListener("change", this.onViewChange);
    window.removeEventListener("resize", this.onViewChange);
    this.root.replaceChildren();
  }

  private applyTheme() {
    for (const [token, value] of Object.entries(this.o.theme ?? {})) this.host.style.setProperty(token, value);
  }

  private userSetOpen(open: boolean) {
    this.setOpen(open);
    this.o.onOpenChange?.(open);
    if (!open && !this.launch.hidden) this.launch.focus();
  }

  /** Puts the widget's chrome in step with its state. */
  private sync() {
    const inHistory = this.view === "history";
    this.panel.hidden = !this.open;
    this.panel.classList.toggle("wide", this.layout === "wide");
    this.panel.classList.toggle("dock", this.layout === "dock");
    this.placePanel();
    this.launch.classList.toggle("covered", this.open && this.layout !== "float");
    this.panel.setAttribute("aria-label", this.o.name);
    this.launch.classList.toggle("open", this.open);
    this.launch.setAttribute("aria-expanded", String(this.open));
    this.launch.setAttribute("aria-label", this.open ? "Close chat" : `Chat with ${this.o.name}`);
    this.launch.innerHTML = this.open ? icons.down : icons.sparkle;
    this.$(".title").textContent = inHistory ? "Past chats" : this.o.name;
    this.$(".back").hidden = !inHistory;
    this.$(".past").hidden = inHistory;
    this.log.hidden = inHistory;
    this.history.hidden = !inHistory;
    this.$("form").hidden = inHistory;
    const expand = this.$(".expand");
    const wide = this.layout === "wide";
    const label = wide ? "Make smaller" : "Expand";
    expand.innerHTML = wide ? icons.collapse : icons.expand;
    expand.setAttribute("aria-label", label);
    expand.title = label;
    const dockit = this.$(".dockit");
    const docked = this.layout === "dock";
    const dockLabel = docked ? "Float" : "Dock to side";
    dockit.innerHTML = docked ? icons.undock : icons.dock;
    dockit.setAttribute("aria-label", dockLabel);
    dockit.title = dockLabel;
    this.reserveRoom();
    this.go.type = this.turn ? "button" : "submit";
    this.go.innerHTML = this.turn ? icons.stop : icons.send;
    this.go.setAttribute("aria-label", this.turn ? "Stop" : "Send");
  }

  private setLayout(next: Layout) {
    this.layout = this.layout === next ? "float" : next;
    this.sync();
    if (this.o.stage) return;
    try {
      localStorage.setItem(LAYOUT_KEY, this.layout);
    } catch {
      // Storage is off: the layout lasts for this page.
    }
  }

  /** A docked panel takes its width from the page, so nothing sits under it. */
  private reserveRoom() {
    const want = this.open && this.layout === "dock" && !this.o.stage && this.roomy.matches;
    const page = document.documentElement;
    if (want && this.reserved === null) {
      this.reserved = page.style.marginRight;
      page.style.marginRight = getComputedStyle(this.panel).width;
    } else if (!want && this.reserved !== null) {
      page.style.marginRight = this.reserved;
      this.reserved = null;
    }
  }

  private showError(message: string | null) {
    this.notice.hidden = !message;
    this.notice.textContent = message ?? "";
  }

  private focusInput() {
    if (this.view === "chat") this.input.focus();
  }

  private fitInput() {
    this.input.style.height = "auto";
    this.input.style.height = `${Math.min(this.input.scrollHeight + 2, 140)}px`;
  }

  private bubble(line: Line) {
    const el = document.createElement("div");
    el.className = `msg ${line.role}`;
    if (line.text) el.textContent = line.text;
    // Still thinking, unless the answer so far is a tool that has finished (a step limit can end a turn there).
    else if (!line.tools?.some((u) => u.state !== "running"))
      el.innerHTML = '<span class="dots" aria-label="Thinking"><i></i><i></i><i></i></span>';
    if (line.sources?.length) {
      const sources = document.createElement("div");
      sources.className = "sources";
      sources.textContent = `Sources: ${[...new Set(line.sources)].join(", ")}`;
      el.appendChild(sources);
    }
    if (line.tools?.length) {
      const tools = document.createElement("div");
      tools.className = "tools";
      for (const use of line.tools) tools.appendChild(use.task ? this.taskCard(use.task) : this.toolLine(use));
      el.appendChild(tools);
    }
    return el;
  }

  /** One tool the answer used: running, done, or why it failed. */
  private toolLine(use: ToolUse) {
    const el = document.createElement("div");
    el.className = `tool ${use.state}`;
    el.textContent =
      use.state === "running"
        ? `Looking up ${use.label}…`
        : use.state === "done"
          ? `✓ ${use.label}`
          : `✕ ${use.label}: ${use.error ?? "failed"}`;
    return el;
  }

  /** A change a tool proposed: applied by Autopilot, or waiting, with Apply when the backend can apply it. */
  private taskCard(task: NonNullable<ToolUse["task"]>) {
    const el = document.createElement("div");
    el.className = "task";
    const title = document.createElement("strong");
    title.textContent = task.title;
    const status = document.createElement("span");
    status.textContent = task.applied ? "Applied. Undo it from Activity." : "Proposed. Nothing changes until it's applied.";
    el.append(title, status);
    const apply = this.o.backend.applyTask;
    if (!task.applied && apply) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Apply";
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await apply.call(this.o.backend, task.id);
          task.applied = true;
          this.showError(null);
          this.drawLog();
        } catch (err) {
          button.disabled = false;
          this.showError(messageOf(err));
        }
      });
      el.appendChild(button);
    } else if (!task.applied) status.textContent = "Proposed. Apply it from Tasks.";
    return el;
  }

  private drawLog() {
    const greeting: Line[] = this.lines.length ? [] : [{ role: "assistant", text: this.o.greeting }];
    this.log.replaceChildren(...[...greeting, ...this.lines].map((l) => this.bubble(l)));
    this.log.scrollTop = this.log.scrollHeight;
  }

  /** Redraws only the answer being written, and follows it unless the person has scrolled up to read. */
  private drawAnswer(answer: Line) {
    const following = this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight < 60;
    this.log.lastElementChild?.replaceWith(this.bubble(answer));
    if (following) this.log.scrollTop = this.log.scrollHeight;
  }

  private cancelTurn() {
    this.turn?.abort();
    this.turn = null;
  }

  private showChat() {
    this.view = "chat";
    this.showError(null);
    this.sync();
    this.focusInput();
  }

  private newChat() {
    this.cancelTurn();
    this.seq++;
    this.chatId = null;
    this.lines = [];
    this.drawLog();
    this.showChat();
  }

  private async resume() {
    try {
      const [latest] = await this.o.backend.list();
      if (latest && !this.chatId && !this.lines.length) await this.openChat(latest.id);
    } catch {
      // Nothing to pick up: the panel starts on a new chat.
    }
  }

  private async openChat(id: string) {
    if (id === this.chatId) return this.showChat();
    this.cancelTurn();
    const seq = ++this.seq;
    this.chatId = id;
    this.lines = [];
    this.log.replaceChildren();
    this.showChat();
    try {
      const lines = await this.o.backend.lines(id);
      if (seq !== this.seq) return;
      this.lines = lines;
    } catch (err) {
      if (seq !== this.seq) return;
      this.chatId = null;
      this.showError(messageOf(err));
    }
    this.drawLog();
  }

  private async showHistory() {
    this.view = "history";
    this.showError(null);
    this.sync();
    this.history.replaceChildren(historyNote("Loading…"));
    try {
      const chats = await this.o.backend.list();
      if (this.view !== "history") return;
      this.history.replaceChildren(...(chats.length ? chats.map((c) => this.historyRow(c)) : [historyNote("No chats yet.")]));
    } catch (err) {
      if (this.view === "history") this.history.replaceChildren(historyNote(messageOf(err)));
    }
  }

  private historyRow(chat: Chat) {
    const row = document.createElement("li");
    row.classList.toggle("current", chat.id === this.chatId);
    const open = document.createElement("button");
    open.type = "button";
    open.className = "open";
    open.textContent = chat.title;
    open.addEventListener("click", () => void this.openChat(chat.id));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon";
    remove.innerHTML = icons.trash;
    remove.title = "Remove";
    remove.setAttribute("aria-label", `Remove ${chat.title}`);
    remove.addEventListener("click", () => void this.removeChat(chat.id));
    row.append(open, remove);
    return row;
  }

  private async removeChat(id: string) {
    try {
      await this.o.backend.remove(id);
    } catch (err) {
      return this.showError(messageOf(err));
    }
    if (id === this.chatId) {
      this.newChat();
      this.view = "history";
    }
    await this.showHistory();
  }

  private submit() {
    const text = this.input.value.trim();
    if (!text || this.turn) return;
    this.input.value = "";
    this.fitInput();
    void this.send(text);
  }

  private async send(text: string) {
    const seq = ++this.seq;
    const live = () => seq === this.seq;
    const turn = new AbortController();
    const question: Line = { role: "user", text };
    const answer: Line = { role: "assistant", text: "" };
    this.turn = turn;
    this.lines.push(question, answer);
    this.showError(null);
    this.sync();
    this.drawLog();
    try {
      const id = this.chatId ?? (await this.o.backend.start(text));
      if (!live()) return;
      this.chatId = id;
      await this.o.backend.send(
        id,
        text,
        {
          onText: (delta) => {
            answer.text += delta;
            if (live()) this.drawAnswer(answer);
          },
          onSources: (titles) => {
            answer.sources = titles;
          },
          onTool: (use) => {
            const tools = (answer.tools ??= []);
            const at = tools.findIndex((u) => u.id === use.id);
            if (at === -1) tools.push(use);
            else tools[at] = use;
            if (live()) this.drawAnswer(answer);
          },
        },
        turn.signal,
      );
      if (!answer.text && !answer.tools?.length) throw new Error("The assistant didn't answer. Try again.");
    } catch (err) {
      if (!live()) return;
      if (turn.signal.aborted) {
        // Stopped by the person: what was written so far stays.
        if (!answer.text) this.lines.pop();
      } else {
        // The turn failed: take it back and return the words, so sending again is one key.
        this.lines = this.lines.filter((l) => l !== question && l !== answer);
        if (err instanceof ChatExpired) this.chatId = null;
        if (!this.input.value) {
          this.input.value = text;
          this.fitInput();
        }
        this.showError(messageOf(err));
      }
      this.drawLog();
    } finally {
      if (this.turn === turn) {
        this.turn = null;
        this.sync();
      }
    }
  }
}

/** Puts the chat widget in `host`, an empty element of the page. */
export function mountChat(host: HTMLElement, options: ChatOptions): ChatHandle {
  return new ChatView(host, options);
}

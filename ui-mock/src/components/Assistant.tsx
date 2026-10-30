import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowUp, CheckCircle2, Eye, History, Maximize2, MessageCircle, Minimize2, SquarePen, Trash2, X, Sparkles } from "lucide-react";
import { cn } from "./ui";
import { LogoMark } from "./Logo";
import { GridMap } from "./GridMap";
import { scanFor } from "./KeywordTable";
import { TaskButton } from "./Todo";
import { gridStats, keywords } from "../data/mock";
import { tasks, useRunState } from "../lib/tasks";
import { timeAgo } from "../lib/runs";
import { ask, closeAssistant, deleteChat, newChat, openChat, setWide, showHistory, suggestionsFor, toggleAssistant, useAssistant, type Block, type PageContext } from "../lib/assistant";

export function MarkoAvatar({ size = 28 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-accent-soft text-accent" style={{ width: size, height: size }} aria-hidden>
      <Sparkles size={size * 0.5} />
    </span>
  );
}

// ---------- Answer blocks ----------

function TaskRows({ ids }: { ids: string[] }) {
  const navigate = useNavigate();
  const state = useRunState();
  const list = ids.map((i) => tasks.find((t) => t.id === i)).filter((t) => !!t);
  if (!list.length) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {list.map((t) => (
        <div key={t.id} className="flex items-center gap-3 border-b border-line px-3.5 py-3 last:border-0">
          <button onClick={() => navigate(`/todo?task=${t.id}`)} className="min-w-0 flex-1 text-left">
            <div className={cn("text-[13.5px] leading-snug font-medium", state[t.id] === "done" && "text-muted line-through decoration-1")}>{t.title}</div>
            <div className="mt-0.5 line-clamp-1 text-[12.5px] text-muted">{t.preview?.after ?? t.why}</div>
          </button>
          <div className="shrink-0"><TaskButton t={t} onOpen={() => navigate(`/todo?task=${t.id}`)} /></div>
        </div>
      ))}
    </div>
  );
}

function MapBlock({ keywordId }: { keywordId: string }) {
  const k = keywords.find((x) => x.id === keywordId)!;
  const now = scanFor(k, 7), past = scanFor(k, 7, true);
  const pct = (s: typeof now) => Math.round(gridStats(s).solv);
  return (
    <div className="rounded-xl border border-line bg-surface p-3.5">
      <div className="mb-2.5 text-[12.5px] text-muted">Map pack rank around your office · “{k.term}”</div>
      <div className="grid grid-cols-2 gap-3">
        {[["Now", now], ["30 days ago", past]].map(([label, scan]) => (
          <div key={label as string}>
            <GridMap scan={scan as typeof now} compact />
            <div className="mt-1.5 flex justify-between text-[12px]"><span className="text-muted">{label as string}</span><span className="num font-medium">{pct(scan as typeof now)}% top 3</span></div>
          </div>
        ))}
      </div>
      <Link to={`/rankings/${k.id}`} className="mt-2.5 inline-block text-[12.5px] text-muted hover:text-fg">Open in Rankings →</Link>
    </div>
  );
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2.5 text-[13.5px] leading-[1.55]">
      {blocks.map((b, i) => {
        if (b.type === "text") return <p key={i} className="m-0">{b.text}</p>;
        if (b.type === "tasks") return <TaskRows key={i} ids={b.ids} />;
        if (b.type === "map") return <MapBlock key={i} keywordId={b.keywordId} />;
        if (b.type === "done") return <p key={i} className="m-0 flex items-start gap-2 text-good"><CheckCircle2 size={15} className="mt-0.5 shrink-0" /><span>{b.text}</span></p>;
        if (b.type === "stats") return (
          <div key={i} className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2">
            {b.items.map((s) => (
              <div key={s.label} className="rounded-lg border border-line bg-surface px-3 py-2">
                <div className="truncate text-[12px] text-muted">{s.label}</div>
                <div className="num text-[15px] font-semibold">{s.value} {s.note && <span className={cn("text-[11.5px] font-medium", s.tone === "bad" ? "text-bad" : "text-good")}>{s.note}</span>}</div>
              </div>
            ))}
          </div>
        );
        return (
          <div key={i} className="flex flex-wrap gap-x-4 gap-y-1">
            {b.items.map((l) => <Link key={l.to} to={l.to} className="text-[13px] text-muted hover:text-fg">{l.label} →</Link>)}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Composer ----------

export function Composer({ ctx, chips, placeholder = "Ask anything, or tell Marko what to do…", big = false }: { ctx: PageContext; chips?: string[]; placeholder?: string; big?: boolean }) {
  const [text, setText] = useState("");
  const { thinking } = useAssistant();
  const send = (t: string) => { ask(t, ctx); setText(""); };
  return (
    <div>
      {!!chips?.length && (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button key={c} onClick={() => send(c)} disabled={thinking} className="h-7 rounded-full border border-line bg-surface px-2.5 text-[12.5px] text-muted transition-colors hover:border-line-strong hover:text-fg disabled:opacity-50">{c}</button>
          ))}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className={cn("flex items-center gap-2 rounded-xl border border-line-strong bg-surface pr-1.5 pl-4 shadow-card focus-within:border-ink", big ? "min-h-[54px]" : "min-h-[46px]")}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label="Message Marko" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-subtle" />
        <button type="submit" aria-label="Send" disabled={!text.trim() || thinking} className={cn("grid shrink-0 place-items-center rounded-lg bg-accent text-white transition-opacity disabled:opacity-40", big ? "size-[38px]" : "size-[34px]")}><ArrowUp size={16} /></button>
      </form>
    </div>
  );
}

// ---------- Panel ----------

/** The ⌘J panel. Docked beside the page on large screens, full screen on small ones. */
export function AssistantPanel({ ctx }: { ctx: PageContext }) {
  const { open, wide, thinking, messages, view, chats, chatId } = useAssistant();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages.length, thinking]);
  if (!open) return null;
  const last = [...messages].reverse().find((m) => m.role === "marko");
  const chips = last?.followUps ?? (messages.length ? [] : suggestionsFor(ctx));

  return (
    <aside aria-label="Marko assistant" className={cn("anim-fade fixed inset-0 z-40 flex flex-col bg-surface lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:shrink-0 lg:border-l lg:border-line print:hidden", wide ? "lg:w-[600px]" : "lg:w-[400px]")}>
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <MarkoAvatar size={26} />
        <span className="text-[14px] font-semibold">Marko</span>
        <kbd className="rounded border border-line px-1 font-sans text-[11px] text-subtle">⌘J</kbd>
        <div className="ml-auto flex items-center gap-0.5">
          <button onClick={() => showHistory(view !== "history")} aria-label="Chats" aria-pressed={view === "history"} title="Chats" className={cn("grid size-8 place-items-center rounded-md text-muted hover:bg-hover hover:text-fg", view === "history" && "bg-active text-fg")}><History size={15} /></button>
          <button onClick={newChat} aria-label="New chat" title="New chat" className="grid size-8 place-items-center rounded-md text-muted hover:bg-hover hover:text-fg"><SquarePen size={15} /></button>
          <button onClick={() => setWide(!wide)} aria-label={wide ? "Make narrower" : "Make wider"} title={wide ? "Narrower" : "Wider"} className="hidden size-8 place-items-center rounded-md text-muted hover:bg-hover hover:text-fg lg:grid">{wide ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
          <button onClick={closeAssistant} aria-label="Close assistant" className="grid size-8 place-items-center rounded-md text-muted hover:bg-hover hover:text-fg"><X size={16} /></button>
        </div>
      </div>

      {view === "history" ? <ChatList chats={chats} current={chatId} /> : <>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-hover px-2.5 py-2 text-[12.5px] text-muted">
          <Eye size={13} className="shrink-0" /> Looking at: <b className="truncate font-medium text-fg">{ctx.label}{ctx.keywordId ? ` · ${keywords.find((k) => k.id === ctx.keywordId)?.term}` : ""}</b>
        </div>
        {!messages.length && (
          <div className="flex gap-3">
            <MarkoAvatar />
            <div className="text-[13.5px] leading-[1.55]">
              <p className="m-0">Hi, I'm Marko. I can look into your rankings, reply to reviews, fix listings, write posts and send reports.</p>
              <p className="mt-2 mb-0 text-muted">I ask before changing anything, unless you've allowed it in <Link to="/settings" className="underline decoration-line-strong underline-offset-2 hover:text-fg">Settings → Automation</Link>. Every change can be undone.</p>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-5">
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-ink px-3.5 py-2.5 text-[13.5px] leading-snug text-on-ink">{m.blocks[0].type === "text" ? m.blocks[0].text : null}</div>
            ) : (
              <div key={m.id} className="anim-fade flex gap-3"><MarkoAvatar /><Blocks blocks={m.blocks} /></div>
            ),
          )}
          {thinking && (
            <div className="flex items-center gap-3"><MarkoAvatar /><span className="flex gap-1" aria-label="Marko is thinking">{[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-pulse rounded-full bg-subtle" style={{ animationDelay: `${i * 150}ms` }} />)}</span></div>
          )}
        </div>
        <div ref={end} />
      </div>

      <div className="border-t border-line px-4 pt-3 pb-4">
        <Composer ctx={ctx} chips={thinking ? [] : chips} placeholder={`Ask about ${ctx.label.toLowerCase()}, or tell Marko what to do…`} />
      </div>
      </>}
    </aside>
  );
}

// ---------- Chat list ----------

function ChatList({ chats, current }: { chats: ReturnType<typeof useAssistant>["chats"]; current: string }) {
  return (
    <div className="flex-1 overflow-y-auto p-2">
      <button onClick={newChat} className="mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13.5px] font-medium hover:bg-hover">
        <SquarePen size={15} /> New chat
      </button>
      {!chats.length && <p className="px-3 py-8 text-center text-[13px] text-muted">No chats yet. Ask Marko anything to start one.</p>}
      <ul>
        {chats.map((c) => {
          const last = [...c.messages].reverse().find((m) => m.role === "marko")?.blocks.find((b) => b.type === "text" || b.type === "done");
          return (
            <li key={c.id} className={cn("group flex items-start gap-1 rounded-lg hover:bg-hover", c.id === current && "bg-active")}>
              <button onClick={() => openChat(c.id)} className="min-w-0 flex-1 px-3 py-2.5 text-left">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{c.title}</span>
                  <span className="shrink-0 text-[11.5px] text-subtle">{timeAgo(c.updated)}</span>
                </div>
                <div className="mt-0.5 truncate text-[12.5px] text-muted">{c.page} · {last && "text" in last ? last.text : `${c.messages.length} messages`}</div>
              </button>
              <button onClick={() => deleteChat(c.id)} aria-label={`Delete chat “${c.title}”`} className="mt-2 mr-1.5 grid size-7 shrink-0 place-items-center rounded-md text-subtle opacity-0 group-hover:opacity-100 hover:bg-surface hover:text-bad focus:opacity-100"><Trash2 size={13} /></button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- Floating button ----------

const POS_KEY = "gw-marko-pos";
const SIZE = 52, EDGE = 12;
const clampPos = (p: { x: number; y: number }) => ({
  x: Math.min(Math.max(EDGE, p.x), window.innerWidth - SIZE - EDGE),
  y: Math.min(Math.max(EDGE, p.y), window.innerHeight - SIZE - EDGE),
});

/** Opens Marko from anywhere. Drag it out of the way; it stays where you drop it. */
export function MarkoLauncher() {
  const { open } = useAssistant();
  const [pos, setPos] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem(POS_KEY) ?? "null"); if (s) return clampPos(s); } catch {}
    return clampPos({ x: window.innerWidth - SIZE - 24, y: window.innerHeight - SIZE - 24 });
  });
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);
  useEffect(() => {
    const onResize = () => setPos((p) => clampPos(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  if (open) return null;

  const down = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, sx: e.clientX, sy: e.clientY, moved: false };
  };
  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return; // a click, not a drag
    d.moved = true;
    setPos(clampPos({ x: e.clientX - d.dx, y: e.clientY - d.dy }));
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) { try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch {} }
    else toggleAssistant();
  };

  return (
    <button
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => { drag.current = null; }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleAssistant(); } }}
      aria-label="Ask Marko (⌘J). Drag to move."
      title="Ask Marko · ⌘J · drag to move"
      className="anim-fade fixed z-40 grid touch-none place-items-center rounded-full border border-line bg-surface shadow-float transition-transform select-none hover:scale-105 active:scale-95 print:hidden"
      style={{ left: pos.x, top: pos.y, width: SIZE, height: SIZE }}
    >
      <LogoMark size={30} />
      {/* Chat badge, so the logo reads as "open a chat". */}
      <span aria-hidden className="absolute -right-0.5 -bottom-0.5 grid size-[22px] place-items-center rounded-full border-2 border-surface bg-ink text-on-ink">
        <MessageCircle size={11} strokeWidth={2.5} />
      </span>
    </button>
  );
}

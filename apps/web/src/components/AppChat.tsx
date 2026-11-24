// The chat widget for the app's own members: the same UI a website embeds (packages/chat-widget), reading and writing
// the member's own conversations. It talks to the widget their Organization uses in the app: its own choice, its
// Partner's, the app's, or the built-in one (ADR 0031). Loaded behind __MODULE_AI__ (Layout).
import { useEffect, useRef, useState } from "react";
import { accentTheme, mountChat, type ChatHandle } from "@app/chat-widget/chat";
import { api } from "../lib/api";
import { CHAT_ASSISTANT_CHANGED } from "../lib/chatAssistant";
import { memberBackend } from "../lib/memberChat";
import { useOrg, useSession } from "../lib/session";
import { useBrand } from "../lib/brand";

// The widget's tokens, in terms of the app's: it follows the theme and a Partner's brand without knowing about them.
const theme = {
  "--cw-bg": "var(--surface)",
  "--cw-soft": "var(--hover)",
  "--cw-line": "var(--border)",
  "--cw-text": "var(--text)",
  "--cw-muted": "var(--muted)",
  "--cw-accent": "var(--accent)",
  "--cw-bad": "var(--bad)",
  "--cw-font": "var(--font-sans)",
  // Over the page and its sticky header, under the mobile menu, dialogs and the command menu.
  "--cw-z": "30",
};

type Using = {
  assistantId: string;
  accent: string | null;
  /** Null while the built-in widget is untouched: the app's own name and greeting show instead. */
  shows: { name: string | null; greeting: string | null };
};

/** Keyed by Organization in Layout: another Organization is a new widget with its own chats. */
export default function AppChat({
  open,
  onOpenChange,
  launcher,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  launcher: boolean;
}) {
  const org = useOrg();
  const { me } = useSession();
  const brand = useBrand();
  const [chat, setChat] = useState<ChatHandle | null>(null);
  // Undefined until the answer comes. Null if it can't be had: the chat then opens as a plain one with the default model.
  const [using, setUsing] = useState<Using | null | undefined>(undefined);
  const openChanged = useRef(onOpenChange);
  useEffect(() => {
    openChanged.current = onOpenChange;
  }, [onOpenChange]);

  useEffect(() => {
    let current = true;
    const ask = async () => {
      const r = await api.api.v1.organizations({ orgId: org.id }).ai["chat-assistant"].get();
      if (current) setUsing(r.data?.inUse ?? null);
    };
    void ask();
    // Choosing a widget on the Widgets page changes the chat without a reload.
    window.addEventListener(CHAT_ASSISTANT_CHANGED, ask);
    return () => {
      current = false;
      window.removeEventListener(CHAT_ASSISTANT_CHANGED, ask);
    };
  }, [org.id]);

  const assistantId = using?.assistantId;
  const accent = using?.accent ?? null;
  // A widget shows its own name and greeting; an untouched built-in one keeps the app's (a Partner's brand).
  const shownName = using?.shows.name ?? null;
  const shownGreeting = using?.shows.greeting ?? null;
  useEffect(() => {
    if (using === undefined) return;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const firstName = me?.name.split(" ")[0];
    const mounted = mountChat(host, {
      backend: memberBackend(org.id, assistantId),
      name: shownName ?? brand.assistant,
      greeting: shownGreeting ?? (firstName ? `Hi ${firstName}. What can I help you with?` : "What can I help you with?"),
      maxLength: 20000,
      launcher: true,
      // The widget's own colour, when it has one; otherwise the app's.
      theme: accent ? { ...theme, ...accentTheme(accent) } : theme,
      onOpenChange: (next) => openChanged.current(next),
    });
    setChat(mounted);
    return () => {
      mounted.destroy();
      host.remove();
    };
    // `using`'s identity changes on every answer: only the parts that show are watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id, brand.assistant, me?.name, using === undefined, assistantId, shownName, shownGreeting, accent]);

  useEffect(() => chat?.setOpen(open), [chat, open]);
  useEffect(() => chat?.setLauncher(launcher), [chat, launcher]);
  return null;
}

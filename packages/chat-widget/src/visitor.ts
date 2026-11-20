// The chat backend for a website's anonymous visitors. A visitor has no account, so their past chats are kept in
// their own browser: each with the token the API signed for it. A chat drops off the list when its token expires.
import { ChatExpired, type Chat, type ChatBackend, type Line, type Reply } from "./chat";

type Saved = Chat & { token: string; expiresAt: number };

const MAX_SAVED = 30;
const TITLE_LENGTH = 80;

async function failure(res: Response, fallback: string): Promise<Error> {
  return new Error(((await res.json().catch(() => null)) as { message?: string } | null)?.message ?? fallback);
}

/** Reads the AI SDK's UI message stream: text deltas, and the sources sent as the answer's metadata. */
async function readStream(res: Response, reply: Reply) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      const chunk = JSON.parse(line.slice(6)) as {
        type: string;
        delta?: string;
        messageMetadata?: { sources?: { documentTitle: string }[] };
        errorText?: string;
      };
      if (chunk.type === "text-delta" && chunk.delta) reply.onText(chunk.delta);
      if (chunk.messageMetadata?.sources) reply.onSources(chunk.messageMetadata.sources.map((s) => s.documentTitle));
      if (chunk.type === "error") throw new Error(chunk.errorText ?? "The assistant ran into a problem.");
    }
  }
}

export function visitorBackend(o: {
  /** The API's origin. */
  api: string;
  assistant: string;
  /** A Turnstile token, when the app uses Turnstile. */
  visitorCheck: () => Promise<string | undefined>;
}): ChatBackend {
  const key = `app-chat:${o.assistant}`;
  // Used when the browser refuses storage (private windows, blocked site data): chats then last for this page.
  let memory: Saved[] = [];

  const read = (): Saved[] => {
    let saved = memory;
    try {
      saved = (JSON.parse(localStorage.getItem(key) ?? "null") as Saved[] | null) ?? memory;
    } catch {
      // Storage is off, or the value isn't ours: fall back to this page's list.
    }
    return saved.filter((s) => s.expiresAt > Date.now());
  };
  const write = (saved: Saved[]) => {
    memory = saved.slice(0, MAX_SAVED);
    try {
      localStorage.setItem(key, JSON.stringify(memory));
    } catch {
      // See `memory`.
    }
  };
  const tokenOf = (id: string) => {
    const saved = read().find((s) => s.id === id);
    if (!saved) throw new ChatExpired("This chat has timed out. Send your message to start a new one.");
    return saved.token;
  };
  const forget = (id: string) => write(read().filter((s) => s.id !== id));
  const expired = (id: string) => {
    forget(id);
    return new ChatExpired("This chat has timed out. Send your message to start a new one.");
  };

  return {
    list: async () => read().map(({ id, title }) => ({ id, title })),

    async lines(id) {
      const res = await fetch(`${o.api}/api/v1/widget/conversations/${id}/messages`, {
        headers: { authorization: `Bearer ${tokenOf(id)}` },
      });
      if (res.status === 401) throw expired(id);
      if (!res.ok) throw await failure(res, `Couldn't load this chat (${res.status}).`);
      const rows = (await res.json()) as { role: string; parts: { text?: string }[]; sources: { documentTitle: string }[] }[];
      return rows.map((m): Line => ({
        role: m.role === "user" ? "user" : "assistant",
        text: m.parts.map((p) => p.text ?? "").join(""),
        sources: m.sources.map((s) => s.documentTitle),
      }));
    },

    async start(firstMessage) {
      const res = await fetch(`${o.api}/api/v1/widget/assistants/${o.assistant}/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ turnstileToken: await o.visitorCheck() }),
      });
      if (!res.ok) throw await failure(res, `Couldn't reach the assistant (${res.status}).`);
      const session = (await res.json()) as { conversationId: string; token: string; expiresAt: number };
      const saved = {
        id: session.conversationId,
        title: firstMessage.slice(0, TITLE_LENGTH),
        token: session.token,
        expiresAt: session.expiresAt,
      };
      write([saved, ...read()]);
      return saved.id;
    },

    async send(id, text, reply, signal) {
      const res = await fetch(`${o.api}/api/v1/widget/conversations/${id}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${tokenOf(id)}` },
        body: JSON.stringify({ text }),
        signal,
      });
      if (res.status === 401) throw expired(id);
      if (!res.ok) throw await failure(res, "The assistant couldn't answer.");
      const saved = read();
      write([...saved.filter((s) => s.id === id), ...saved.filter((s) => s.id !== id)]);
      await readStream(res, reply);
    },

    // Only from this browser's list: the conversation stays with the Organization that owns the assistant.
    remove: async (id) => forget(id),
  };
}

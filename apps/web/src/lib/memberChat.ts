// The chat widget's backend for a signed-in member: their own conversations, over HTTP. With an assistant, the chats
// with that assistant (a preview in Widgets); without, plain chats with the app's models. Only lazy pages import this.
import type { ChatBackend, Line } from "@app/chat-widget/chat";
import { api, messageOf, readChatStream } from "./api";

export function memberBackend(orgId: string, assistantId?: string): ChatBackend {
  const conversations = () => api.api.v1.organizations({ orgId }).ai.conversations;
  return {
    async list() {
      const { data, error } = await conversations().get({ query: {} });
      if (error) throw new Error(messageOf(error));
      return data.filter((c) => c.assistantId === (assistantId ?? null)).map((c) => ({ id: c.id, title: c.title }));
    },
    async lines(conversationId) {
      const { data, error } = await conversations()({ conversationId }).messages.get();
      if (error) throw new Error(messageOf(error));
      return data.map((m): Line => ({
        role: m.role === "user" ? "user" : "assistant",
        text: (m.parts as { text?: string }[]).map((p) => p.text ?? "").join(""),
        sources: m.sources?.map((s) => s.documentTitle),
      }));
    },
    async start() {
      const { data, error } = await conversations().post(assistantId ? { assistantId } : {});
      if (error) throw new Error(messageOf(error));
      return data.id;
    },
    async send(id, text, reply, signal) {
      const res = await fetch(`/api/v1/organizations/${orgId}/ai/conversations/${id}/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
        signal,
      });
      if (!res.ok)
        throw new Error(
          ((await res.json().catch(() => null)) as { message?: string } | null)?.message ??
            `The assistant couldn't answer (${res.status}).`,
        );
      await readChatStream(res, reply.onText, (sources) => reply.onSources(sources.map((s) => s.documentTitle)));
    },
    async remove(conversationId) {
      const { error } = await conversations()({ conversationId }).delete();
      if (error) throw new Error(messageOf(error));
    },
  };
}

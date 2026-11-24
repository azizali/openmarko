// The chat widget's backend for a signed-in member: their own conversations, over HTTP. With an assistant, the chats
// with that assistant (a preview in Widgets); without, plain chats with the app's models. Only lazy pages import this.
// The member's chat may use tools (ADR 0036): each message says which page they're on, tool calls show as lines, and
// a Task a tool proposed can be applied from the chat.
import { toolUse, type ChatBackend, type Line, type ToolUse } from "@app/chat-widget/chat";
import { api, messageOf, readChatStream } from "./api";
import { announceTasksChanged } from "./tasksChanged";

type Part = { type: string; text?: string; toolName?: string; toolCallId?: string; state?: string; output?: unknown; errorText?: string };

/** Where the member is: the path and its query (`?location=…`), within what the API accepts. */
function currentPage() {
  const params = Object.fromEntries(
    [...new URLSearchParams(window.location.search)].slice(0, 10).map(([k, v]) => [k.slice(0, 40), v.slice(0, 200)]),
  );
  return { path: window.location.pathname.slice(0, 300), params };
}

/** A saved answer as the chat shows it: its text, a paragraph per step, and the tools it used. */
function lineOf(role: string, parts: Part[], sources?: string[]): Line {
  const steps: string[] = [""];
  const tools: ToolUse[] = [];
  for (const p of parts) {
    if (p.type === "step-start" && steps[steps.length - 1]) steps.push("");
    else if (p.type === "text") steps[steps.length - 1] += p.text ?? "";
    else if (p.type === "dynamic-tool" && p.toolCallId && p.toolName)
      tools.push(toolUse(p.toolCallId, p.toolName, p.state === "output-error" ? { errorText: p.errorText ?? "" } : { output: p.output }));
  }
  return {
    role: role === "user" ? "user" : "assistant",
    text: steps.filter(Boolean).join("\n\n"),
    sources,
    ...(tools.length ? { tools } : {}),
  };
}

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
      return data.map((m) =>
        lineOf(
          m.role,
          m.parts as Part[],
          m.sources?.map((s) => s.documentTitle),
        ),
      );
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
        body: JSON.stringify({ text, page: currentPage() }),
        signal,
      });
      if (!res.ok)
        throw new Error(
          ((await res.json().catch(() => null)) as { message?: string } | null)?.message ??
            `The assistant couldn't answer (${res.status}).`,
        );
      // Each step's text is its own paragraph; a tool's line follows its call, then its result.
      let wrote = false;
      const names = new Map<string, string>();
      await readChatStream(
        res,
        (delta) => {
          wrote = true;
          reply.onText(delta);
        },
        (sources) => reply.onSources(sources.map((s) => s.documentTitle)),
        (chunk) => {
          const callId = String(chunk.toolCallId ?? "");
          if (chunk.type === "start-step" && wrote) {
            reply.onText("\n\n");
            wrote = false;
          } else if (chunk.type === "tool-input-available") {
            names.set(callId, String(chunk.toolName));
            reply.onTool?.(toolUse(callId, String(chunk.toolName), null));
          } else if (chunk.type === "tool-output-available") {
            const use = toolUse(callId, names.get(callId) ?? "tool", { output: chunk.output });
            reply.onTool?.(use);
            if (use.task) announceTasksChanged(use.task.applied);
          } else if (chunk.type === "tool-output-error" || chunk.type === "tool-input-error")
            reply.onTool?.(
              toolUse(callId, names.get(callId) ?? String(chunk.toolName ?? "tool"), { errorText: String(chunk.errorText ?? "") }),
            );
        },
      );
    },
    async remove(conversationId) {
      const { error } = await conversations()({ conversationId }).delete();
      if (error) throw new Error(messageOf(error));
    },
    async applyTask(taskId) {
      const { error } = await api.api.v1.organizations({ orgId }).tasks({ taskId }).apply.post();
      if (error) throw new Error(messageOf(error));
      announceTasksChanged(true);
    },
  };
}

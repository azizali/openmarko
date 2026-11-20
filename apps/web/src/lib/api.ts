// The API, typed from its routes (Eden). The app calls its own origin: /api/* is forwarded to the API (Vercel in
// production, Vite in development), so the session cookie is first-party.
import { treaty } from "@elysiajs/eden";
import type { Api } from "@app/server";

export const api = treaty<Api>(window.location.origin, { fetch: { credentials: "include" } });

/** The API's error shape, { code, message }, or a fallback for anything else. */
export function messageOf(error: { value?: unknown; status?: number } | null | undefined): string {
  const v = error?.value as { message?: string } | string | undefined;
  if (v && typeof v === "object" && v.message) return v.message;
  if (typeof v === "string" && v) return v;
  return error?.status ? `Something went wrong (${error.status}).` : "Something went wrong.";
}

/** Reads the AI SDK's UI message stream: text deltas, and the sources sent as the answer's metadata. */
export async function readChatStream(
  res: Response,
  onText: (delta: string) => void,
  onSources: (sources: { n: number; documentTitle: string }[]) => void,
): Promise<void> {
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
        messageMetadata?: { sources?: { n: number; documentTitle: string }[] };
        errorText?: string;
      };
      if (chunk.type === "text-delta" && chunk.delta) onText(chunk.delta);
      if (chunk.messageMetadata?.sources) onSources(chunk.messageMetadata.sources);
      if (chunk.type === "error") throw new Error(chunk.errorText ?? "The assistant ran into a problem.");
    }
  }
}

export const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
export const fmtTime = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
export const money = (micros: number) => `$${(micros / 1_000_000).toFixed(2)}`;

// Turning a document into plain text (S1.6). Text and Markdown as they are; HTML without its markup; PDFs through
// unpdf (pdf.js); a web page fetched first. Scanned PDFs (images only) give no text: a paid parser can come later.
import { extractText, getDocumentProxy } from "unpdf";
import { AppError } from "@app/kernel";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

export type Kind = "text" | "markdown" | "pdf" | "html" | "url";

/** HTML to readable text: scripts, styles and markup gone, block ends kept as line breaks, entities decoded. */
export function htmlToText(html: string): { text: string; title: string | null } {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null;
  const body = html
    .replace(/<(script|style|noscript|svg|head|nav|footer)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr|br|blockquote|pre)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return { text: tidy(body), title: title ? tidy(title) : null };
}

const tidy = (s: string) =>
  s
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export async function pdfToText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return tidy(Array.isArray(text) ? text.join("\n\n") : text);
}

/** Fetches a web page (or a PDF at a URL), within a time and size limit. */
export async function fetchUrl(url: string): Promise<{ kind: "html" | "pdf" | "text"; bytes: Uint8Array }> {
  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "app-knowledge/1.0" },
      redirect: "follow",
    });
  } catch (err) {
    throw new AppError(422, "fetch_failed", `Couldn't fetch ${url}: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) throw new AppError(422, "fetch_failed", `${url} answered ${res.status}.`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) throw new AppError(422, "too_large", "That page is over 10 MB.");
  const type = res.headers.get("content-type") ?? "";
  return { kind: type.includes("pdf") ? "pdf" : type.includes("html") ? "html" : "text", bytes };
}

/** The text of a document, by kind. */
export async function textOf(kind: Kind, bytes: Uint8Array, sourceUrl?: string | null): Promise<string> {
  if (kind === "url") {
    const page = await fetchUrl(sourceUrl!);
    return textOf(page.kind, page.bytes);
  }
  if (kind === "pdf") return pdfToText(bytes);
  const s = new TextDecoder().decode(bytes);
  return kind === "html" ? htmlToText(s).text : tidy(s);
}

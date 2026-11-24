// The Markdown an assistant writes, shown as formatted text: paragraphs, headings, lists, code, bold, italics and
// links. Parsed into a small tree first (pure, tested), then built with DOM calls, never innerHTML: the text comes from
// a model and the widget runs on other people's websites, so nothing in it can become markup. Links open only http(s)
// and mailto addresses. An answer still streaming parses the same way; an unclosed `**` simply shows as written.

export type Inline =
  | { t: "text"; text: string }
  | { t: "strong" | "em"; children: Inline[] }
  | { t: "code"; text: string }
  | { t: "link"; href: string; children: Inline[] }
  | { t: "br" };

export type Block =
  | { t: "p"; children: Inline[] }
  | { t: "h"; children: Inline[] }
  | { t: "ul" | "ol"; items: Inline[][]; start?: number }
  | { t: "pre"; text: string };

const SAFE_HREF = /^(https?:\/\/|mailto:)/i;

/** Inline Markdown: `code`, **bold**, *italics* or _italics_, [text](address), and line breaks. */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => {
    if (text) out.push({ t: "text", text });
    text = "";
  };
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpExecArray | null;
    if (rest[0] === "\n") {
      flush();
      out.push({ t: "br" });
      i++;
    } else if ((m = /^`([^`\n]+)`/.exec(rest))) {
      flush();
      out.push({ t: "code", text: m[1]! });
      i += m[0].length;
    } else if ((m = /^\*\*(?=\S)([^]*?\S)\*\*/.exec(rest)) || (m = /^__(?=\S)([^]*?\S)__/.exec(rest))) {
      flush();
      out.push({ t: "strong", children: parseInline(m[1]!) });
      i += m[0].length;
    } else if ((m = /^\*(?=[^\s*])([^*\n]*?[^\s*])\*/.exec(rest)) || (m = /^_(?=[^\s_])([^_\n]*?[^\s_])_(?![A-Za-z0-9])/.exec(rest))) {
      // `_` inside a word (snake_case) is left alone: italics start at a word's edge.
      if (rest[0] === "_" && /[A-Za-z0-9]/.test(src[i - 1] ?? "")) {
        text += rest[0];
        i++;
        continue;
      }
      flush();
      out.push({ t: "em", children: parseInline(m[1]!) });
      i += m[0].length;
    } else if ((m = /^\[([^\]\n]+)\]\(([^)\s]+)\)/.exec(rest)) && SAFE_HREF.test(m[2]!)) {
      flush();
      out.push({ t: "link", href: m[2]!, children: parseInline(m[1]!) });
      i += m[0].length;
    } else {
      text += rest[0];
      i++;
    }
  }
  flush();
  return out;
}

const LIST_ITEM = /^\s{0,3}([-*+]|\d{1,3}[.)])\s+(.*)$/;

/** Block Markdown: ``` fences, # headings, - or 1. lists, and paragraphs split by blank lines. */
export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const endPara = () => {
    if (para.length) blocks.push({ t: "p", children: parseInline(para.join("\n")) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^\s*```/.test(line)) {
      endPara();
      const code: string[] = [];
      for (i++; i < lines.length && !/^\s*```/.test(lines[i]!); i++) code.push(lines[i]!);
      blocks.push({ t: "pre", text: code.join("\n") });
      continue;
    }
    const heading = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      endPara();
      blocks.push({ t: "h", children: parseInline(heading[1]!) });
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      endPara();
      const ordered = /\d/.test(item[1]!);
      const list: Block & { t: "ul" | "ol" } = ordered
        ? { t: "ol", items: [], start: Number.parseInt(item[1]!, 10) }
        : { t: "ul", items: [] };
      // The list runs while its lines are items of the same kind, or an item's indented continuation.
      let current: string[] = [item[2]!];
      for (i++; i < lines.length; i++) {
        const next = LIST_ITEM.exec(lines[i]!);
        if (next && /\d/.test(next[1]!) === ordered) {
          list.items.push(parseInline(current.join("\n")));
          current = [next[2]!];
        } else if (!next && /^\s{2,}\S/.test(lines[i]!)) current.push(lines[i]!.trim());
        else break;
      }
      list.items.push(parseInline(current.join("\n")));
      blocks.push(list);
      i--;
      continue;
    }
    if (!line.trim()) endPara();
    else para.push(line);
  }
  endPara();
  return blocks;
}

function inlineNodes(doc: Document, parts: Inline[]): Node[] {
  return parts.map((p) => {
    switch (p.t) {
      case "text":
        return doc.createTextNode(p.text);
      case "br":
        return doc.createElement("br");
      case "code": {
        const el = doc.createElement("code");
        el.textContent = p.text;
        return el;
      }
      case "link": {
        const el = doc.createElement("a");
        el.href = p.href;
        el.target = "_blank";
        el.rel = "noopener noreferrer";
        el.append(...inlineNodes(doc, p.children));
        return el;
      }
      default: {
        const el = doc.createElement(p.t);
        el.append(...inlineNodes(doc, p.children));
        return el;
      }
    }
  });
}

/** The answer as formatted elements, built without innerHTML. */
export function renderMarkdown(doc: Document, src: string): DocumentFragment {
  const frag = doc.createDocumentFragment();
  for (const b of parseMarkdown(src)) {
    if (b.t === "pre") {
      const pre = doc.createElement("pre");
      pre.textContent = b.text;
      frag.appendChild(pre);
    } else if ("items" in b) {
      const list = doc.createElement(b.t);
      if (b.t === "ol" && b.start && b.start !== 1) list.setAttribute("start", String(b.start));
      for (const item of b.items) {
        const li = doc.createElement("li");
        li.append(...inlineNodes(doc, item));
        list.appendChild(li);
      }
      frag.appendChild(list);
    } else {
      const el = doc.createElement(b.t === "h" ? "h4" : "p");
      el.append(...inlineNodes(doc, b.children));
      frag.appendChild(el);
    }
  }
  return frag;
}

// The assistant's Markdown, parsed into the tree the widget builds from. Nothing in it becomes markup: links open
// only http(s) and mailto addresses.
import { describe, expect, test } from "bun:test";
import { parseInline, parseMarkdown } from "../src/markdown";

describe("markdown in the chat", () => {
  test("bold, italics, code and links", () => {
    expect(parseInline("**Fix** the *hours* in `profile` at [Google](https://google.com)")).toEqual([
      { t: "strong", children: [{ t: "text", text: "Fix" }] },
      { t: "text", text: " the " },
      { t: "em", children: [{ t: "text", text: "hours" }] },
      { t: "text", text: " in " },
      { t: "code", text: "profile" },
      { t: "text", text: " at " },
      { t: "link", href: "https://google.com", children: [{ t: "text", text: "Google" }] },
    ]);
  });

  test("a link that isn't http(s) or mailto stays text", () => {
    expect(parseInline("[click](javascript:alert(1))")).toEqual([{ t: "text", text: "[click](javascript:alert(1))" }]);
  });

  test("markup in the text stays text", () => {
    expect(parseInline("<img src=x onerror=alert(1)>")).toEqual([{ t: "text", text: "<img src=x onerror=alert(1)>" }]);
  });

  test("snake_case names aren't italics, and an unclosed ** shows as written", () => {
    expect(parseInline("automation__recent_activity")).toEqual([{ t: "text", text: "automation__recent_activity" }]);
    expect(parseInline("**still streaming")).toEqual([{ t: "text", text: "**still streaming" }]);
  });

  test("paragraphs, headings, both kinds of list and code blocks", () => {
    const blocks = parseMarkdown(
      "I have two tools:\n\n1. **View** recent activity\n2. Propose a rename\n   that waits for Apply\n\n## Next\n- one\n- two\n\n```\ncode\n```",
    );
    expect(blocks.map((b) => b.t)).toEqual(["p", "ol", "h", "ul", "pre"]);
    const ol = blocks[1] as { items: unknown[][] };
    expect(ol.items).toHaveLength(2);
    expect(ol.items[1]).toEqual([{ t: "text", text: "Propose a rename" }, { t: "br" }, { t: "text", text: "that waits for Apply" }]);
    expect(blocks[4]).toEqual({ t: "pre", text: "code" });
  });
});

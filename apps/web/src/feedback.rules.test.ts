// Keeps ADR 0030 true as the app grows. Messages come from <Feedback>, <ToastProvider> and <LoadError> in
// components/Feedback.tsx; files come from <FileInput>. A page that builds its own fails here, with the reason.
import { expect, test } from "bun:test";
import { Glob } from "bun";
import { readFileSync } from "node:fs";

const root = new URL("./", import.meta.url).pathname;
const files = [...new Glob("{pages,components}/**/*.tsx").scanSync(root)].map((path) => ({
  path,
  text: readFileSync(root + path, "utf8"),
}));

/** Files that may contain `pattern`, because they are where it is implemented. */
const offenders = (pattern: RegExp, allowed: string[]) =>
  files.filter((f) => !allowed.includes(f.path) && pattern.test(f.text)).map((f) => f.path);

test("messages are announced only by components/Feedback.tsx", () => {
  expect(offenders(/role="(alert|status)"|aria-live=/, ["components/Feedback.tsx"])).toEqual([]);
});

test("success and error tints belong to Feedback and the Badge, not to a page", () => {
  expect(offenders(/bg-(good|bad)-soft/, ["components/Feedback.tsx", "components/ui.tsx"])).toEqual([]);
});

test("a page keeps no error or saved state of its own: use useFeedback() or useToast()", () => {
  expect(offenders(/\[(error|note|result|made), set\w+\] = useState<string \| null>|\[saved, setSaved\] = useState\(false\)/, [])).toEqual(
    [],
  );
});

test("the browser's own file button is never shown: use <FileInput>", () => {
  expect(offenders(/type="file"/, ["components/ui.tsx"])).toEqual([]);
});

test("a message is not rendered at the top of a page", () => {
  // <Feedback> sits in an action row, never as the first thing a page returns.
  expect(offenders(/<PageHeader[\s\S]{0,400}?\/>\s*<Feedback/, [])).toEqual([]);
});

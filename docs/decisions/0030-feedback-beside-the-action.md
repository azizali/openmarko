# 0030. Feedback appears beside the action

- Status: Accepted
- Date: 2026-11-09
- Affects: web

## Context

A failed save showed "Invalid AI settings" in a `Notice` at the top of the page. On a page taller than the screen the person had pressed Save at the bottom and saw nothing. Every page placed its own `Notice`, so placement and wording varied, and only two pages used the separate toast. There was no rule for where a new page should put its messages.

## Decision

Every success or failure message is shown by one component, `Feedback`, driven by one hook, `useFeedback()`, in one of two places:

1. **Beside the action.** When the person pressed a button that stays on screen, the message appears in that button's own action row: the side panel footer, a card's action row, or the end of an inline form. On a page with several sections, each section's row shows its own message.
2. **Toast.** When the action has no action row of its own (a button in a table or list row, a toggle, copy, delete, a background result, or a panel that closes on success), the message appears as a toast at the bottom of the screen.

A message is never placed at the top of a page. The one exception is a page that could not load at all, which keeps an inline `Notice` where its content would be.

Behaviour, the same in both places:

- **Errors stay** until dismissed or the next attempt. **Successes** clear after 5 seconds; the timer pauses on hover and focus.
- **Wording:** a short lead-in ("Could not save", "Saved"), then the reason and what to do. Never the raw server code.
- **Accessibility:** the live region is in the page before any message arrives. Errors use `role="alert"`, successes `role="status"`. Every message has an icon as well as colour, and a dismiss button that is at least 40px on touch. Focus stays on the button that was pressed. Reduced motion removes the slide.
- A field-specific error also goes under its field (`aria-describedby`), in addition to the message beside the action.

## Consequences

- A person never has to scroll to find the result of what they just did.
- A new page picks pattern 1 or 2 by one question: does the button that caused it stay on screen? There is no third place.
- `Notice` as a top-of-form message and `useToast` are replaced by `Feedback` and `useFeedback`; the page-level `<Notice>{error}</Notice>` lines are removed.
- `Feedback`, `useFeedback()`, `ToastProvider`, `useToast()` and `LoadError` live in `apps/web/src/components/Feedback.tsx`; a panel passes its `<Feedback>` to `Drawer`'s `feedback` slot, which pins it above the footer buttons. `Callout` (in `ui.tsx`) is for a plain note that is not a result.
- A file is taken with `FileInput` (`ui.tsx`), never the browser's own button.
- Enforced: `apps/web/src/feedback.rules.test.ts` runs in `bun run check` and fails a page that announces its own message, tints its own success or error, keeps its own error/saved state, or uses a bare file input.
- The rule is recorded in the design system (`apps/web/DESIGN.md`, Feedback) so later screens follow it without re-deciding.

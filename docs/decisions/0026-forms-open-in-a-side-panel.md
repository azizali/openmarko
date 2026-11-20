# 0026. Forms open in a side panel

- Status: Accepted
- Date: 2026-11-08
- Affects: web

## Context

The app had two overlays for the same job. Most forms opened in a centered `Modal`; the Role editor opened in a right-side `Drawer`. Each handled focus and Escape by hand, neither kept focus inside, and the chat widget's floating button sits where a side panel's footer lands.

## Decision

- Every form opens in `Drawer`, from the right edge. `Modal` is gone. A form passes `onSubmit` and its actions go in `footer`, which stays at the bottom of the panel.
- `Drawer`, the command menu and the phone navigation are all `ModalDialog`, a native modal `<dialog>`. The browser keeps focus inside, makes the page inert, draws it above the chat widget and returns focus to what opened it.
- A dialog is mounted only while open, and focuses its first field when it opens.

## Consequences

- A fork gets one overlay to restyle, and a new form needs no focus or Escape code.
- A short form leaves most of the panel empty. That is the price of every form opening the same way.
- A question that only needs yes or no still uses the browser's `confirm()`.
- Anything meant to show above an open panel must itself be in the top layer: a high `z-index` is not enough.

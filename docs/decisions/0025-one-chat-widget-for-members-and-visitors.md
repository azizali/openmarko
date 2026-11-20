# 0025. One chat widget for members and visitors

- Status: Accepted
- Date: 2026-11-08
- Affects: ai, web, chat-widget

## Context

The app needs a floating chat with past chats, a new chat and expand, opened from the sidebar. Websites that embed an Assistant need the same thing for their visitors. Members are signed in and own their conversations on the server. Visitors are anonymous and hold a signed token per conversation.

## Decision

- One UI, in `packages/chat-widget`: plain DOM in a shadow root, no dependencies, so the embeddable script stays small.
- The UI talks to a `ChatBackend` (list, lines, start, send, remove). The web app gives it the member's conversations routes; the embed script gives it the visitor routes.
- `apps/web` imports the package. It holds no API code, so the frontend still reaches the API over HTTP only.
- One page, Widgets, replaces the Assistant page's Chat and Assistants tabs. A widget is an Assistant: no new table. Its preview is the same UI with `stage` set, chatting through the member's routes, so it works before any website is allowed. Members chat through the floating widget.
- The panel floats, docks to the side of the page, or goes wide over most of the screen. Docking reserves its width as a right margin on the page, on the app and on any website, and only while the panel is open.
- A visitor's past chats live in their own browser (`localStorage`), each with its token, until the token expires. Removing one takes it off that browser's list; the conversation stays with the Organization.

## Consequences

- A change to the widget reaches members and websites together.
- The app restyles it by mapping the `--cw-*` tokens to its own variables, so it follows the theme and a Partner's brand.
- A visitor's history doesn't follow them to another browser, and lasts as long as the token (24 hours).

---
name: App
description: The signed-in web app of a SaaS boilerplate, in black ink on graph paper, with one brand color each fork or Partner can replace.
colors:
  drafting-ink: "#09090b"
  on-ink: "#fafafa"
  highlighter-pink: "#db2777"
  highlighter-tint: "#fde3f1"
  focus-pink: "#fe7bcd"
  graph-paper: "#fafafa"
  clean-sheet: "#ffffff"
  sidebar-sheet: "#fcfcfc"
  hover-wash: "#f4f4f5"
  selected-wash: "#ebebee"
  hairline: "#e4e4e7"
  firm-line: "#d4d4d8"
  pencil-gray: "#5c5c66"
  faint-pencil: "#6d6d78"
  good: "#15803d"
  good-tint: "#ecfdf3"
  bad: "#dc2626"
  bad-tint: "#fef2f2"
  warn: "#b45309"
  warn-tint: "#fef6e4"
  info: "#1d4ed8"
  info-tint: "#eff4ff"
  night-paper: "#09090b"
  night-sheet: "#111113"
  night-sidebar: "#0c0c0e"
  night-hover: "#1c1c1f"
  night-selected: "#27272a"
  night-hairline: "#232326"
  night-firm-line: "#3f3f46"
  night-ink: "#fafafa"
  night-pencil: "#a1a1aa"
  night-faint-pencil: "#8b8b95"
  night-highlighter: "#fe7bcd"
  night-highlighter-tint: "#3a1a2c"
typography:
  display:
    fontFamily: "Frank Ruhl Libre, ui-serif, Georgia, serif"
    fontSize: "34px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Frank Ruhl Libre, ui-serif, Georgia, serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  figure:
    fontFamily: "Frank Ruhl Libre, ui-serif, Georgia, serif"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Roboto Flex, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
  body:
    fontFamily: "Roboto Flex, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "Roboto Flex, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "Roboto Flex, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: 1.5
  section-label:
    fontFamily: "Roboto Flex, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0.06em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "32px"
  page: "48px"
components:
  button-primary:
    backgroundColor: "{colors.drafting-ink}"
    textColor: "{colors.on-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.clean-sheet}"
    textColor: "{colors.drafting-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.hover-wash}"
  button-ghost:
    textColor: "{colors.pencil-gray}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.hover-wash}"
    textColor: "{colors.drafting-ink}"
  input:
    backgroundColor: "{colors.clean-sheet}"
    textColor: "{colors.drafting-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  card:
    backgroundColor: "{colors.clean-sheet}"
    rounded: "{rounded.lg}"
    padding: "20px"
  badge:
    backgroundColor: "{colors.hover-wash}"
    textColor: "{colors.pencil-gray}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  badge-accent:
    backgroundColor: "{colors.highlighter-tint}"
    textColor: "{colors.highlighter-pink}"
  nav-row:
    textColor: "{colors.pencil-gray}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "28px"
  nav-row-active:
    backgroundColor: "{colors.selected-wash}"
    textColor: "{colors.drafting-ink}"
  side-panel:
    backgroundColor: "{colors.clean-sheet}"
    textColor: "{colors.drafting-ink}"
    width: "480px"
---

# Design System: App

## Overview

**Creative North Star: "The Drafting Table"**

The interface disappears into the work. Pages are drawn in black ink on faint graph paper, with one serif title to say where you are. Color appears once per view, where it means something.

The app is an Operate surface: people come to finish a task, often between other jobs and sometimes on a phone. Density is compact and text is small but high in contrast, so a page holds a lot without feeling crowded. The serif appears only in titles and headline figures. Everything a person reads while working is in the sans.

This is also a boilerplate that forks and Partners re-skin, so the system's character lives in ink, line and spacing. The brand arrives through the accent tokens and the logo, and a page must still look finished when that accent is someone else's blue.

**Key Characteristics:**

- Near-monochrome ink and neutrals, with a single replaceable accent.
- Serif titles over a compact sans working layer.
- A faint graph-paper grid and brand glow that fade out down the page.
- Cards are drawn with a hairline border, not lifted by a shadow, and hairlines divide what is inside them.
- Every form opens in one side panel.

## Colors

Neutrals with almost no hue, black ink for anything decisive, and one highlighter that a Partner's brand color can replace.

### Primary

- **Highlighter Pink:** marks the one thing on a page worth noticing, the way a highlighter would: the Owner badge, an accent action, the logo's fill. Each Partner's brand color replaces it at runtime through the accent tokens.
- **Highlighter Tint:** the pale wash behind accent text on badges and soft emphasis.
- **Focus Pink:** keyboard focus rings and the focused field's border. It follows the brand color when whitelabeled.

### Neutral

- **Drafting Ink:** primary buttons, titles, the current tab's underline, on-state toggles. Flips to near-white in dark mode, with On Ink as its opposite.
- **Graph Paper:** the page background, under the grid.
- **Clean Sheet:** cards, panels, fields and menus.
- **Sidebar Sheet:** the app sidebar, one small step off the page.
- **Hover Wash** and **Selected Wash:** row hover, and the current item in any navigation.
- **Hairline** and **Firm Line:** dividers inside surfaces, and field or button borders on hover.
- **Pencil Gray:** secondary text, descriptions, inactive navigation.
- **Faint Pencil:** hints, placeholders, section labels. It is the lightest gray allowed for text, at 4.5:1 or better on every light surface.

The `night-*` tokens are the same roles in dark mode. Dark mode is designed as its own palette, with tinted near-blacks and a brighter highlighter.

### Semantic

**Good**, **Bad**, **Warn** and **Info** each come with a matching tint. They carry status only: badges, notices, deltas and chart lines.

### Named Rules

**The One Highlighter Rule.** The accent appears at most once or twice in a view, and only where it means something. Primary actions are ink, never accent, by default.

**The Replaceable Brand Rule.** Never hard-code the pink. Use the accent, tint and ring tokens, so a Partner's color reaches everything.

## Typography

**Display Font:** Frank Ruhl Libre (with ui-serif, Georgia)
**Body Font:** Roboto Flex (with ui-sans-serif, system-ui)

**Character:** A warm, slightly bookish serif names each page, and a neutral variable sans does all the work beneath it. The contrast is the system's one flourish.

### Hierarchy

- **Display** (page titles only, one per page): the page's name, in the serif.
- **Headline** (panel titles; the sign-in card goes a step larger): names an overlay or account screen.
- **Figure** (headline numbers in Stat tiles and plan prices): serif with tabular numerals.
- **Title** (card and list-section headings): sans at medium weight, so a card never competes with the page title.
- **Body** (default text) and **Control** (buttons, fields, tables at 13.5px): the working layer. Descriptions stay under about 42rem wide.
- **Label** (field labels, table headers from 12px up): medium weight in Pencil Gray.
- **Section Label** (groups in the Settings rail and menus, uppercase with wide tracking): organizes navigation only. It never sits above a page title.

### Named Rules

**The Serif Names, Sans Works Rule.** The serif is for page titles, panel titles and headline figures. Labels, buttons, table cells and card headings are always sans.

**The Tabular Rule.** Any number that sits in a column or changes in place uses tabular numerals.

## Layout

A fixed 240px sidebar sits beside a page column capped at 1180px, with side padding of 16px on phones, 32px on tablets and 48px on desktop. Below 1024px the sidebar becomes a hamburger-opened sheet under a 48px sticky bar. Settings adds a second 184px rail of navigation. Below 1024px there is no rail: `/settings` is a list of every section under its group's title, each row opening that section with a "‹ Settings" link back to the list.

Spacing is tight inside a group and generous between groups: 16px between sibling cards, 20px inside a card, 28px under a page header. Pages with the floating chat button keep 96px free at the bottom so it never covers a last row.

On phones, tables stack each row into a heading and label-value pairs, so actions stay on screen. On touch devices, controls grow to at least 36px without changing the desktop's density.

## Elevation & Depth

The system is flat at rest. Cards lie on the page, drawn with a 1px hairline border and almost no shadow, in light and dark mode alike, and hairlines divide what is inside them. Only what truly sits above the page, overlays and the sign-in card, carries a real shadow.

### Shadow Vocabulary

- **Sheet** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.03)`, always with a hairline border): cards, tables and the plain resting surfaces of a page.
- **Float** (`box-shadow: 0 24px 64px -16px rgb(0 0 0 / 0.14), 0 4px 12px rgb(0 0 0 / 0.04)`): side panels, menus, the command menu, toasts, the sign-in card.
- **Control** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.03)`): primary and secondary buttons, choice cards.

### Named Rules

**The Sheets Don't Stack Rule.** A card is never placed inside a card. Inside a sheet, divide with hairlines.

**The Hairline Rule.** A resting surface gets a hairline border, never a floating shadow. A real shadow means the thing is above the page.

## Shapes

Gently rounded and consistent, with radius rising by the size of the object: nav rows and small buttons at the small step, buttons and fields at the medium step, cards at the large step, the sign-in card at the largest. Badges and toasts are full pills. Side panels are square and flush with the screen edge. Icons are Lucide at a 1.75 stroke, 13 to 16px in the working layer.

## Components

Controls are exact and unfussy: small, tight and high in contrast, with precise states and no decoration.

### Buttons

- **Shape:** gently rounded at the medium step; the small size drops to the small step at 28px tall.
- **Primary:** ink fill with On Ink text, one per view where possible. Hover lowers opacity to 85%.
- **Secondary:** Clean Sheet with a hairline border; hover firms the border and adds Hover Wash.
- **Ghost, Accent, Danger:** Ghost for row actions, Accent used sparingly, Danger a bordered button with red text.
- **New:** anything that starts something new ("New role", "Add document", "Invite") is a `NewButton`: primary with a plus in front. A form's own submit ("Create", "Save") has no plus.
- **Press / Focus / Disabled:** presses scale to 97% over 150ms. Focus is a 2px Focus Pink outline at a 2px offset. Disabled drops to 50% opacity.

### Inputs / Fields

- **Style:** Clean Sheet, hairline border, medium radius, 36px tall by default.
- **Hover / Focus:** hover firms the border. Focus turns the border Focus Pink with a 3px ring at 20% opacity.
- **Dropdowns:** the closed control matches the other fields with a drawn chevron. The open list stays native.
- **Error:** a Bad-colored hint under the field, linked with `aria-describedby`, plus the message beside the action (see Feedback).
- **File:** a slim row the height of a field: a small secondary button ("Choose file", then "Change file" once one is picked), then the file name and size, truncated. Dashed hairline border, solid once filled; dropping a file on it works. It wraps a real, visually hidden input, so keyboard and screen readers behave as for a native one. The accepted types sit beneath as a hint. Never the browser's own file button.

### Feedback

Every success or failure message is one `Feedback` (ADR 0030), a soft Good or Bad tint with an icon, a short lead-in, the reason, and a dismiss button. It appears in one of two places and never at the top of a page.

- **Beside the action:** in the action row of the button that was pressed. That is the side panel footer, a card's action row, or the end of an inline form. A page with several sections shows each section's message in its own row.
- **Toast:** when nothing visible owns the action (row menu, toggle, copy, delete, background result). A pill-shaped Float surface at the bottom of the screen.
- **Page could not load:** an inline Notice where the content would be. The only message allowed near the top.
- **Timing:** errors stay until dismissed or the next attempt. Successes clear after 5 seconds, paused on hover and focus.
- **Accessibility:** the live region exists before the message. Errors are `role="alert"`, successes `role="status"`. Icon and lead-in carry the meaning along with colour. Dismiss is at least 40px on touch. Focus stays on the pressed button. Reduced motion removes the slide.

### Cards / Containers

- **Corner Style:** the large radius.
- **Background:** Clean Sheet with a hairline border and the Sheet shadow.
- **Internal Padding:** 20px, or none when a list or table fills it edge to edge.

### Chips

- **Badges:** small tinted pills, neutral by default, a semantic tint for status, and the accent tint for rare emphasis. Role names are capitalized.

### Navigation

- **Rows:** 13px sans, 28px tall, 15px icon. Inactive is Pencil Gray; hover adds Hover Wash; current is Selected Wash with medium weight. The sidebar and the Settings and Admin rails share this row.
- **Groups:** related pages sit under an expandable parent row with a chevron, as AI holds Widgets and Knowledge base. Sub-items drop their icons and hang from a hairline. A group starts expanded, remembers being collapsed, and its parent takes the current state while collapsed.
- **Sidebar foot:** below a hairline, Settings sits above the account row: avatar, name, role, then icon buttons for theme and sign out. Settings isn't an Organization section, so it carries no heading.
- **Menu list (phones):** a `MenuGroup` per group, with its Section Label and hint above a bordered card of `MenuLink` rows: icon, name and a chevron, at least 44px tall. Sideways-scrolling strips of links are not used for navigation.
- **Tabs:** text with a 2px ink underline on the current tab. Arrow keys move between them.
- **Segmented control:** a Hover Wash track with the current option lifted on a Clean Sheet.

### Side Panel

The single home for forms. It slides in 16px from the right over 220ms with an ease-out curve, on a 28% black scrim, 480px wide by default and up to 640px for heavy editors, full width on phones. A serif title and close button sit at the top, the body scrolls, and actions stay pinned at the bottom. It focuses the first field on open and returns focus to its opener on close.

### Empty States

A quiet icon, a one-line title, a sentence that teaches what the thing is, and the action that starts it.

### Page Backdrop

An 80px graph-paper grid under a soft brand glow, fading out over the first 520px of the page. It is decoration behind the header and never reaches working content.

## Do's and Don'ts

### Do:

- **Do** open every form in the side panel, with its actions in the panel footer.
- **Do** use ink for the primary action and keep the accent for rare emphasis.
- **Do** draw resting surfaces with a hairline border, and use hairlines for division inside them.
- **Do** test every new screen with a non-pink accent and in dark mode.
- **Do** keep text at Faint Pencil or darker, and draw focus with Focus Pink.
- **Do** show the result of an action beside the button that caused it, or as a toast when no button remains.
- **Do** reuse the shared navigation row, fields and buttons rather than restyling them on a page.
- **Do** keep the ink-to-brand sheen for a single word in a headline. It is the one sanctioned gradient on text.

### Don't:

- **Don't** render a success or error message at the top of a page, or write a one-off message style. Use `Feedback`.
- **Don't** show the browser's own file button.
- **Don't** open a form in a centered dialog. Forms belong in the side panel.
- **Don't** hard-code the pink or any brand color.
- **Don't** give a resting card a floating shadow, or put a card inside a card.
- **Don't** set labels, buttons, table cells or card headings in the serif.
- **Don't** replace a native dropdown's open list with a custom menu.
- **Don't** let the page grid or glow run behind working content.

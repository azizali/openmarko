# App shell & scope: roadmap

## Current state

Navigation, switcher, Scope, ⌘K, guards, Needs, toolbars and dark mode are complete in the mock.

## Stubbed in the mock

| Looks like it works | What's really there |
|---|---|
| Settings → Profile (Change photo, Manage sign-in) | Static; buttons do nothing. |
| Settings → Notifications | Toggles only; nothing sends. |
| Settings → Plan & billing | Static "Growth plan $79/month" with sample usage bars; Change plan does nothing. |
| "Updated X ago" | From seeded runs in memory. |
| Scope | In memory; resets on reload; not in the URL. |

## To build

1. Auth-backed You settings (profile, sign-in methods).
2. Notification delivery (email, Slack via `notify.send`).
3. Billing (plans, usage metering, invoices); owner-only changes.
4. Scope persisted in URL/session.

## Open questions

- Billing page shows $79 "Growth"; the marketing site prices Local $99, Agency $299, Agency Max $599. Which is current?

## Changelog

- `3c54111` "feat: better sidebar"; `a6f4887` "feat: simplified UI" (removed Simple/Pro modes); `48c2a91` "feat: ui common".

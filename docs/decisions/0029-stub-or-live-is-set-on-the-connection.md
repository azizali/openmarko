# 0029. Stub or live is set on the Connection

- Status: Accepted
- Date: 2026-11-08
- Affects: integrations, web, deploy
- Amends: [0013](0013-stub-or-live-providers.md)

## Context

`PROVIDERS` and `PROVIDERS_LIVE` chose a Connection's mode from the environment, when it was made. Trying a real key meant editing `.env` or the deploy config, restarting, and adding the key in a second place. A key added before that change saved without complaint and was then ignored. Every Connection already stores its own mode, and every call reads it from there.

## Decision

- `PROVIDERS` and `PROVIDERS_LIVE` are gone. The Connection's own mode is the only switch.
- An app admin chooses live or stub in Admin → Connections when connecting one of the app's accounts, and can switch it later. Going live needs a stored key when the provider requires one.
- A key an Organization adds in Settings → Integrations is live. Organizations don't see the choice.
- A Connection made in code is a stub unless the code says otherwise, so tests never reach a vendor.

## Consequences

- Trying a real key is one step in one place, with no restart.
- An Organization's key on a provider whose live adapter isn't built fails with a clear error rather than quietly returning made-up data.
- A seeded Connection holds a placeholder key. Going live with it fails at the vendor, so it's disconnected and connected again with a real key.

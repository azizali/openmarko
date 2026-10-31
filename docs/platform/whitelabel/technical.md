# Whitelabel: technical

## Code map

| File | Role |
|---|---|
| [lib/whitelabel.ts](../../../ui-mock/src/lib/whitelabel.ts) | Store (`gw-whitelabel`), `whitelabeled()`, `product()`, `assistant()`, `maker()`, `appHost()`, `dnsZone()`, `productMark()`, `brandLogo/Icon/Accent()`, `applyBrand()` |
| [pages/Whitelabel.tsx](../../../ui-mock/src/pages/Whitelabel.tsx) | Settings → Whitelabel (Brand, Domain, Emails); also `Clients` |
| [main.tsx](../../../ui-mock/src/main.tsx) | Calls `applyBrand()` before first render |
| [App.tsx](../../../ui-mock/src/App.tsx) | `useWhitelabel()` at the root so names re-render on change |

## Data

```ts
type Whitelabel = {
  on: boolean;
  name: string;            // blank → Partner name
  assistant: string;       // blank → "AI Assistant"
  logo: string | null;     // data URL
  icon: string | null;     // data URL
  accent: string;
  domain: { host: string; status: "none" | "dns" | "live" };
  email: { sender: string; address: string; verified: boolean };
  support: string;
};
```

`whitelabeled()` = a Partner exists **and** `on`. Without a Partner (Local plan) everything shows OpenMarko / Marko with accent `#db2777`.

`applyBrand()` sets `--accent`, `--accent-soft`, `--ring`, `--glow`, `--sheen-a/b/c`, `document.title` and the favicon.

## Rules for code

- Never hardcode "OpenMarko" or "Marko" in user-facing strings. Use `product()`, `assistant()`, `maker()` ("Prepared by").
- Feature labels that name the assistant compute it (`features.ts`: `assistant() === "Marko" ? "Marko assistant" : assistant()`).

## Real build

- A whitelabel row per Partner.
- Resolve the brand from the request host **before the first byte**, so title and favicon never flash ours.
- Custom domain: CNAME to us, automatic SSL; fallback `{slug}.openmarko.com` always works.
- Email: verify the Partner's sending domain; until verified, send from the fallback.
- Neutral DNS zone we own (`mailedge.net` placeholder) runs DKIM and bounces for Client records.

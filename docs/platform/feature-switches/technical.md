# Feature switches: technical

## Code map

| File | Role |
|---|---|
| [data/features.ts](../../../ui-mock/src/data/features.ts) | `FeatureId`, `Feature` catalog: `module`, `needsAny`, `connection`, `links` (pages owned), `settings` (sections owned), `off` (what changes), `agencyOnly` |
| [lib/features.ts](../../../ui-mock/src/lib/features.ts) | Store `gw-features`; `statusOf`, `isOn`, `useOn`, `knockOn`, `featureForPage` (most specific link wins), `pageOn`, `settingsOwner` |
| [pages/Features.tsx](../../../ui-mock/src/pages/Features.tsx) | Settings → Features |
| [components/Layout.tsx](../../../ui-mock/src/components/Layout.tsx) | Filters nav and ⌘K with `pageOn`; renders `FeatureOff` |

## Data

```ts
type Feature = {
  id: FeatureId; label; blurb;
  module?: FeatureId;          // absent on modules
  needsAny?: FeatureId[];      // at least one must be on
  connection?: "social_accounts" | "ad_account" | "email_sending" | "texting" | "sequencer";
  links?: string[];            // pages it owns, path or path?query
  settings?: string[];         // Settings sections it owns
  off?: string;                // what else changes
  agencyOnly?: boolean;
};
type Flags = Partial<Record<FeatureId, boolean>>;  // missing = on
```

`statusOf(id)` → `{ on, why? }` where `why` is its own switch, its module, or a missing dependency.

## Rules for code

- Gate every cross-feature control with `useOn(id)` / `isOn(id)`, and add a sentence to that feature's `off` describing it.
- A new page must be listed in its feature's `links` so `featureForPage` maps it (this also drives access checks).
- A new `FeatureId` must also get actions in `data/access.ts` (type error otherwise) and a docs folder.

## Real build

`features` JSON column on `organizations`, read by the API too, so a turned-off feature also stops its background jobs (scans, sends, reviews).

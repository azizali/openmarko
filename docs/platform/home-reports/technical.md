# Home & reports: technical

## Code map

| File | Role |
|---|---|
| [pages/CommandCenter.tsx](../../../ui-mock/src/pages/CommandCenter.tsx) | Home |
| [components/CommandTop.tsx](../../../ui-mock/src/components/CommandTop.tsx) | Summary, Presence score, social this week |
| [components/Todo.tsx](../../../ui-mock/src/components/Todo.tsx) | "This week" list |
| [pages/Reports.tsx](../../../ui-mock/src/pages/Reports.tsx) | Report list, preview, keyword progress |
| [lib/content.ts](../../../ui-mock/src/lib/content.ts) | Articles shown in the report |

## Data

Reads mock data (`data/mock.ts`, `data/scoped.ts`, `lib/social.ts`, `lib/watch.ts`, `lib/tasks.ts`). No report entity is persisted.

## Permissions

Home, Reports and To-do have no owning feature, so `pageAllowed` lets every Member open them. Blocks inside follow feature switches; they don't check role.

## Real build

- Presence score computed server-side from the latest runs.
- `reports` table (sections, recipients, cadence); a scheduled job renders the PDF (whitelabelled) and emails it from the Partner's sender.
- The assistant writes the summary with the `report-summary` skill.

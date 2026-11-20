/** Time-ordered UUIDs (v7), made in the app so inserts stay at the end of the index (schema.md). */
export const newId = (): string => Bun.randomUUIDv7();

import { invalid } from "@app/kernel";
import type { Field } from "@app/shared";

/**
 * Checks the values a person entered against the provider's fields, and splits them: secret fields go to the
 * encrypted credentials (ADR 0010), the rest become the Connection's settings. Unknown keys, missing required
 * fields and choices outside a field's options are refused, so an adapter always gets what it reads.
 */
export function splitFieldValues(
  provider: { name: string; fields?: (Field & { startsWith?: string })[] },
  values: Record<string, string>,
): { secrets: Record<string, string>; settings: Record<string, string> } {
  const fields = provider.fields ?? [];
  const known = new Set(fields.map((f) => f.key));
  const problems: string[] = [];
  for (const k of Object.keys(values)) if (!known.has(k)) problems.push(`${k}: not a field of ${provider.name}`);
  const secrets: Record<string, string> = {};
  const settings: Record<string, string> = {};
  for (const f of fields) {
    const v = values[f.key]?.trim();
    if (!v) {
      if (!f.optional) problems.push(`${f.key}: required`);
      continue;
    }
    if (f.options && !f.options.includes(v)) problems.push(`${f.key}: must be one of ${f.options.join(", ")}`);
    if (f.startsWith && !v.startsWith(f.startsWith)) problems.push(`${f.key}: must start with ${f.startsWith}`);
    if (f.key === "webhookSecret" && !f.startsWith && v.length < 16) problems.push(`${f.key}: must be at least 16 characters`);
    (f.secret ? secrets : settings)[f.key] = v;
  }
  if (problems.length) throw invalid(`Check the ${provider.name} details.`, { problems });
  return { secrets, settings };
}

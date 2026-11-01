import { invalid } from "@openmarko/kernel";
import type { Provider } from "@openmarko/shared";

/**
 * Checks the values a person entered against the provider's fields, and splits them: secret fields go to the
 * encrypted credentials (ADR 0010), the rest become the Connection's settings. Unknown keys, missing required
 * fields and choices outside a field's options are refused, so an adapter always gets what it reads.
 */
export function splitFieldValues(
  provider: Provider,
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
    (f.secret ? secrets : settings)[f.key] = v;
  }
  if (problems.length) throw invalid(`Check the ${provider.name} details.`, { problems });
  return { secrets, settings };
}

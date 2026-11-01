import { invalid } from "@openmarko/kernel";

/** "https://www.MapleAndMain.com/about/" → "mapleandmain.com". Only the domain is kept (audits are per domain). */
export function normalizeDomain(input: string): string {
  const raw = input.trim().toLowerCase();
  const withScheme = /^[a-z]+:\/\//.test(raw) ? raw : `https://${raw}`;
  let host: string;
  try {
    host = new URL(withScheme).hostname;
  } catch {
    throw invalid("That doesn't look like a website address.", { input });
  }
  host = host.replace(/^www\./, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) throw invalid("That doesn't look like a domain.", { input });
  return host;
}

/**
 * A Google Business Profile's website link may be a deep link ("example.com/implants"). We keep it for display
 * and reduce it to its domain for anything that is audited.
 */
export function domainOfLink(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    return normalizeDomain(link);
  } catch {
    return null;
  }
}

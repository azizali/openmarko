/**
 * The visitor's city, guessed from their IP address, so the homepage can open on their town.
 *
 * Today this calls ipapi.co from the browser (free, no key, about 1,000 lookups a day). It sends the
 * visitor's IP to that service, so the privacy policy must say so. Once hosting is chosen, replace it
 * with the host's edge geo header (Vercel `x-vercel-ip-city`, Cloudflare `cf-ipcity`): no third party,
 * no rate limit. A guess can be wrong (VPNs, mobile carriers), so the page always lets them change it.
 */

const CACHE = "om-geo-city";
const ENDPOINT = "https://ipapi.co/json/";

/** Resolves to a city name, or null if the lookup fails, is slow or is blocked. Never throws. */
export async function cityFromIp(timeoutMs = 2000): Promise<string | null> {
  try {
    const cached = sessionStorage.getItem(CACHE);
    if (cached !== null) return cached || null;
  } catch {}
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(ENDPOINT, { signal: ctrl.signal });
    const city = res.ok ? ((await res.json()) as { city?: unknown }).city : null;
    const value = typeof city === "string" && city.trim() ? city.trim() : "";
    try { sessionStorage.setItem(CACHE, value); } catch {}
    return value || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

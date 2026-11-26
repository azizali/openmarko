// The website a visitor typed on the marketing site (?site= on /sign-up or /sign-in). It's kept in this tab's
// sessionStorage so it survives the steps in between: creating the account, a round trip through Google's sign-in,
// and creating the Organization. SEO setup reads it to start the search for the business, then forgets it.
const KEY = "start-site";

/** "https://www.Example.com/" → "www.example.com"; null when it can't be a web address. */
export function cleanSite(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
  return v.length <= 200 && /^[^\s/]+\.[a-z]{2,}(\/\S*)?$/.test(v) ? v : null;
}

/** Keeps `?site=` from the current address, if it's a web address. Returns the site now remembered, if any. */
export function rememberSite(search: string): string | null {
  const site = cleanSite(new URLSearchParams(search).get("site"));
  try {
    if (site) sessionStorage.setItem(KEY, site);
    return site ?? sessionStorage.getItem(KEY);
  } catch {
    return site; // storage blocked: it still shows on this page
  }
}

export function pendingSite(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function forgetSite() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing kept
  }
}

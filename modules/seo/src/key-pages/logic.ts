// Key pages, from one crawl: the pages a Location most wants customers to land on, each for some tracked keywords, and
// the pages about the same thing that should link to them but don't. A link whose words name the keyword tells search
// engines which page to show for it, and passes some of the linking page's weight. Pure: the crawl, the key pages and
// the keywords in; the links to add, and the pages worth making key pages, out.
//
// What a page is "about" is read from its address, title and main heading. Words that say what the whole site is
// about (in the home page's title or heading, or on most pages: the trade, "dentist" on a dentist's site) and the city
// say nothing about one page, so they're left out: a page is about a keyword when it names each of its other words. A
// keyword with none left ("dentist austin") is the home page's to rank for: no key page is suggested for it, and it
// finds no pages to link from.

export type CrawledPage = { url: string; statusCode: number; depth: number | null; title: string | null; h1: string | null };
export type CrawledLink = { from: string; to: string };
export type TrackedKeyword = {
  id: string;
  term: string;
  monthlySearches: number | null;
  /** The page Google shows for it now. */ yourUrl: string | null;
};
export type KeyPageInput = { id: string; path: string; keywords: { term: string; monthlySearches: number | null }[] };

/** A key page as the crawl found it, with the pages that should link to it. */
export type KeyPageLinks = {
  id: string;
  path: string;
  /** The crawled page at that path; null when the crawl didn't find it (or it answered with an error). */
  url: string | null;
  title: string | null;
  /** Pages of the site that link to it. */
  linksIn: number;
  /** The words to link with: its keyword with the most searches that has pages to link from. */
  keyword: string | null;
  monthlySearches: number | null;
  /** Pages to link from, strongest first: each is about one of its keywords and doesn't link to it yet. */
  from: { url: string; title: string | null }[];
};

/** A page worth making a key page, for the tracked keywords it should rank for. */
export type KeyPageIdea = {
  path: string;
  url: string;
  title: string | null;
  keywords: { id: string; term: string; monthlySearches: number | null }[];
  /** Google shows it for one of those keywords now (else it's the site's page most about them). */
  shownByGoogle: boolean;
};

/** At most this many pages to link from, per key page: past three, more links from look like a pattern. */
export const LINKS_PER_KEY_PAGE = 3;

const STOP = new Set(
  "a an and at best by for from in me my near nearby of on open the to top with what know how your you our we is are page home blog post html php www https http com".split(
    " ",
  ),
);

/** The words of some text, lower-cased, a plural made singular. */
export function wordsOf(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((w) => !STOP.has(w) && w.length > 1)
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}

/** Where a page lives, without the domain or a trailing slash: "/services/whitening". Takes a path too. */
export const pathOf = (url: string) => {
  try {
    return new URL(url, "https://x.invalid").pathname.replace(/\/$/, "") || "/";
  } catch {
    return url;
  }
};

const titleOf = (p: CrawledPage) => p.h1 ?? p.title;

/** What one crawl says each page is about, and which words say nothing about any one page. */
function readSite(pages: CrawledPage[], links: CrawledLink[], city: string | null) {
  const live = pages.filter((p) => p.statusCode >= 200 && p.statusCode < 300);
  const about = new Map(live.map((p) => [p.url, new Set(wordsOf(`${pathOf(p.url)} ${p.title ?? ""} ${p.h1 ?? ""}`))]));
  // Words on most pages (the trade, the business's name in every title) say nothing about any one of them.
  const seen = new Map<string, number>();
  for (const words of about.values()) for (const w of words) seen.set(w, (seen.get(w) ?? 0) + 1);
  const common = (w: string) => (seen.get(w) ?? 0) > Math.max(2, live.length * 0.6);
  const cityWords = new Set(wordsOf(city ?? ""));
  // The home page's title and heading say what the whole site is about ("Dentist in Austin"), not any one page.
  const home = live.find((p) => p.depth === 0);
  const site = new Set(home ? wordsOf(`${home.title ?? ""} ${home.h1 ?? ""}`) : []);
  const linksIn = new Map<string, number>();
  const linked = new Set<string>();
  for (const l of links) {
    linksIn.set(l.to, (linksIn.get(l.to) ?? 0) + 1);
    linked.add(`${l.from} ${l.to}`);
  }
  const byPath = new Map<string, CrawledPage>();
  for (const p of live) if (!byPath.has(pathOf(p.url))) byPath.set(pathOf(p.url), p);
  return {
    live,
    byPath,
    linksIn: (url: string) => linksIn.get(url) ?? 0,
    links: (from: string, to: string) => linked.has(`${from} ${to}`),
    /** A keyword's words that tell one page from another. */
    words: (term: string) => [...new Set(wordsOf(term))].filter((w) => !cityWords.has(w) && !site.has(w) && !common(w)),
    /** How many of the words a page names, as a share. */
    share: (url: string, words: string[]) => words.filter((w) => about.get(url)?.has(w)).length / words.length,
  };
}

/** Each key page as the crawl found it, and up to three pages about its keywords that don't link to it yet. */
export function keyPageLinks(input: {
  pages: CrawledPage[];
  links: CrawledLink[];
  keyPages: KeyPageInput[];
  city: string | null;
}): KeyPageLinks[] {
  const s = readSite(input.pages, input.links, input.city);
  return input.keyPages.map((k) => {
    const page = s.byPath.get(pathOf(k.path)) ?? null;
    const none = { id: k.id, path: pathOf(k.path), url: page?.url ?? null, title: page ? titleOf(page) : null };
    if (!page) return { ...none, linksIn: 0, keyword: null, monthlySearches: null, from: [] };
    const from = new Map<string, CrawledPage>();
    let keyword: KeyPageInput["keywords"][number] | null = null;
    for (const kw of k.keywords.toSorted((a, b) => (b.monthlySearches ?? 0) - (a.monthlySearches ?? 0))) {
      const words = s.words(kw.term);
      if (!words.length) continue;
      const found = s.live.filter((p) => p.url !== page.url && s.share(p.url, words) === 1 && !s.links(p.url, page.url));
      if (found.length && !keyword) keyword = kw;
      for (const p of found) from.set(p.url, p);
    }
    const best = [...from.values()]
      .toSorted((a, b) => s.linksIn(b.url) - s.linksIn(a.url) || (a.depth ?? 9) - (b.depth ?? 9) || a.url.localeCompare(b.url))
      .slice(0, LINKS_PER_KEY_PAGE);
    return {
      ...none,
      linksIn: s.linksIn(page.url),
      keyword: keyword?.term ?? null,
      monthlySearches: keyword?.monthlySearches ?? null,
      from: best.map((p) => ({ url: p.url, title: titleOf(p) })),
    };
  });
}

/**
 * Pages worth making key pages, most searched first: for each tracked keyword no key page is for, the page Google
 * shows for it (when the crawl found it, and it isn't the home page, which ranks for everything), else the shallowest
 * page about it (a service's page before a post that mentions it). Pages already key pages, or turned down, are left out.
 */
export function suggestKeyPages(input: {
  pages: CrawledPage[];
  keywords: TrackedKeyword[];
  /** Paths that are key pages already, or were turned down. */
  taken: Set<string>;
  /** Keywords a key page is already for. */
  assigned: Set<string>;
  city: string | null;
}): KeyPageIdea[] {
  const s = readSite(input.pages, [], input.city);
  const ideas = new Map<string, KeyPageIdea>();
  const open = input.keywords.filter((k) => !input.assigned.has(k.id));
  for (const k of open.toSorted((a, b) => (b.monthlySearches ?? 0) - (a.monthlySearches ?? 0))) {
    const words = s.words(k.term);
    if (!words.length) continue;
    const shown = k.yourUrl ? s.byPath.get(pathOf(k.yourUrl)) : undefined;
    const page =
      shown && shown.depth !== 0
        ? shown
        : s.live
            .filter((p) => p.depth !== 0 && s.share(p.url, words) >= 0.5)
            .toSorted(
              (a, b) => (a.depth ?? 9) - (b.depth ?? 9) || s.share(b.url, words) - s.share(a.url, words) || a.url.length - b.url.length,
            )[0];
    if (!page) continue;
    const path = pathOf(page.url);
    if (input.taken.has(path)) continue;
    const idea = ideas.get(path) ?? { path, url: page.url, title: titleOf(page), keywords: [], shownByGoogle: false };
    idea.keywords.push({ id: k.id, term: k.term, monthlySearches: k.monthlySearches });
    idea.shownByGoogle ||= page === shown;
    ideas.set(path, idea);
  }
  return [...ideas.values()];
}

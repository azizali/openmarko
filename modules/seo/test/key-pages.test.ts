// Key pages, from one crawl: the pages that should link to each key page, and the pages worth making key pages.
import { describe, expect, test } from "bun:test";
import { keyPageLinks, pathOf, suggestKeyPages, wordsOf, type CrawledPage } from "../src/key-pages/logic";

const site = "https://smile.test/";
const page = (path: string, title: string, depth: number, statusCode = 200): CrawledPage => ({
  url: `${site}${path}`,
  statusCode,
  depth,
  title,
  h1: title.split(" | ")[0]!,
});
const pages = [
  page("", "Smile Dental | Dentist in Austin", 0),
  page("services", "Services | Smile Dental", 1),
  page("about", "About Smile Dental", 1),
  page("services/whitening", "Whitening in Austin | Smile Dental", 2),
  page("services/invisalign", "Invisalign in Austin | Smile Dental", 2),
  page("blog/whitening-myths", "Teeth whitening myths | Smile Dental", 3),
  page("blog/whitening-at-home", "Teeth whitening at home | Smile Dental", 3),
  page("blog/braces-or-aligners", "Braces or Invisalign? | Smile Dental", 3),
  page("blog/old", "Teeth whitening offer | Smile Dental", 3, 404),
];
const links = [
  { from: `${site}`, to: `${site}services` },
  { from: `${site}services`, to: `${site}services/whitening` },
  { from: `${site}services`, to: `${site}services/invisalign` },
  { from: `${site}blog/whitening-myths`, to: `${site}services/whitening` },
  { from: `${site}`, to: `${site}blog/whitening-at-home` },
];
const kw = (id: string, term: string, monthlySearches: number | null, yourUrl: string | null = null) => ({
  id,
  term,
  monthlySearches,
  yourUrl,
});

describe("key pages", () => {
  test("words: plurals made singular, filler and the address's parts dropped", () => {
    expect(wordsOf("Best teeth whitening near me in Austin")).toEqual(["teeth", "whitening", "austin"]);
    expect(wordsOf("/services/dental-implants")).toEqual(["service", "dental", "implant"]);
    expect(pathOf(`${site}services/whitening/`)).toBe("/services/whitening");
    expect(pathOf("/services/whitening/")).toBe("/services/whitening");
  });

  test("a key page gets links from the live pages about its keywords that don't link there yet", () => {
    const [whitening, invisalign] = keyPageLinks({
      pages,
      links,
      city: "Austin",
      keyPages: [
        { id: "1", path: "/services/whitening/", keywords: [{ term: "teeth whitening austin", monthlySearches: 900 }] },
        { id: "2", path: "/services/invisalign", keywords: [{ term: "invisalign austin", monthlySearches: 1200 }] },
      ],
    });
    // whitening-myths links there already; the 404 page is gone; the services page and myths post link in.
    expect(whitening).toMatchObject({
      path: "/services/whitening",
      title: "Whitening in Austin",
      linksIn: 2,
      keyword: "teeth whitening austin",
    });
    expect(whitening!.from.map((f) => pathOf(f.url))).toEqual(["/blog/whitening-at-home"]);
    expect(invisalign!.from.map((f) => pathOf(f.url))).toEqual(["/blog/braces-or-aligners"]);
  });

  test("a key page the crawl didn't find, or with no keywords, has nothing to add", () => {
    const [gone, bare] = keyPageLinks({
      pages,
      links,
      city: "Austin",
      keyPages: [
        { id: "1", path: "/services/implants", keywords: [{ term: "dental implants", monthlySearches: 300 }] },
        { id: "2", path: "/services/whitening", keywords: [] },
      ],
    });
    expect(gone).toMatchObject({ url: null, linksIn: 0, from: [] });
    expect(bare).toMatchObject({ url: `${site}services/whitening`, keyword: null, from: [] });
  });

  test("suggested key pages: the page Google shows, else the shallowest page about the keyword, never home", () => {
    const ideas = suggestKeyPages({
      pages,
      city: "Austin",
      taken: new Set(),
      assigned: new Set(),
      keywords: [
        kw("a", "teeth whitening", 900, `${site}blog/whitening-myths`),
        kw("b", "invisalign austin", 1200, site),
        kw("c", "whitening austin", 100),
      ],
    });
    expect(ideas.map((i) => [i.path, i.keywords.map((k) => k.id), i.shownByGoogle])).toEqual([
      ["/services/invisalign", ["b"], false],
      ["/blog/whitening-myths", ["a"], true],
      ["/services/whitening", ["c"], false],
    ]);
  });

  test("pages already key pages or turned down, keywords a key page has, and the trade and city aren't suggested", () => {
    const ideas = suggestKeyPages({
      pages,
      city: "Austin",
      taken: new Set(["/services/whitening"]),
      assigned: new Set(["b"]),
      keywords: [
        kw("a", "whitening austin", 900),
        kw("b", "invisalign", 1200),
        kw("c", "smile dental austin", 50),
        kw("d", "root canal", 50),
      ],
    });
    expect(ideas).toEqual([]);
  });
});

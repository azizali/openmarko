// The pure pieces: where a grid's spots are, how a business did across them, and recognising businesses in text.
import { describe, expect, test } from "bun:test";
import { spotsOf, standingOf, standingsOf, zoomFor } from "../src/lib/grid";
import { excerptOf, mentionsIn, nameForms, normalizeQuestion, normalizeTerm } from "../src/lib/text";
import { baseline, weekly } from "../src/results/series";

describe("the grid", () => {
  test("spots spread evenly, north edge first, with the door in the middle", () => {
    const spots = spotsOf({ lat: 30, lng: -97 }, 3, 1000);
    expect(spots).toHaveLength(9);
    expect(spots[4]).toMatchObject({ idx: 4, row: 1, col: 1, lat: 30, lng: -97 });
    expect(spots[1]!.lat).toBeGreaterThan(30); // north
    expect(spots[5]!.lng).toBeGreaterThan(-97); // east
    expect((spots[1]!.lat - 30) * 111_320).toBeCloseTo(1000, 0);
  });

  test("closer spots need a closer zoom", () => {
    expect(zoomFor(7, 900)).toBe(17);
    expect(zoomFor(7, 3000)).toBe(15);
    expect(zoomFor(5, 25_000)).toBe(13);
  });

  test("a standing: spots in the top 3, average (21 where missing), door, best and worst side", () => {
    // 3 × 3: top-3 on the north row, missing on the south row.
    const s = standingOf(3, [1, 2, 3, 5, 4, 6, null, null, null]);
    expect(s).toEqual({ top3Spots: 3, avgPosition: 9.3, doorPosition: 4, bestSide: "north", worstSide: "south" });
    expect(standingOf(3, Array(9).fill(null))).toMatchObject({ top3Spots: 0, avgPosition: 21, bestSide: null });
  });

  test("standings for everyone seen, from the order at each spot", () => {
    const all = standingsOf(1, [["a", "b"]]);
    expect(all.get("a")?.top3Spots).toBe(1);
    expect(all.get("b")?.doorPosition).toBe(2);
  });
});

describe("words", () => {
  test("keywords and questions are kept one way", () => {
    expect(normalizeTerm("  Dentist   AUSTIN ")).toBe("dentist austin");
    expect(normalizeQuestion("who is the best dentist in austin")).toBe("Who is the best dentist in austin?");
    expect(normalizeQuestion("Best dentist.")).toBe("Best dentist?");
  });

  test("a business is recognised by its name, with or without its filler words, in the order named", () => {
    const named = mentionsIn("Try Zilker Dental, or Maple and Main Dental. Smile is a word.", [
      { name: "Maple & Main Dental" },
      { name: "Zilker Dental Co." },
      { name: "Smile" },
    ]);
    expect(named.map((n) => n.name)).toEqual(["Zilker Dental Co.", "Maple & Main Dental"]);
    expect(nameForms("Smile")).toEqual([]);
  });

  test("an excerpt ends at a sentence or a word", () => {
    expect(excerptOf("Short.")).toBe("Short.");
    const long = `${"word ".repeat(80)}end.`;
    expect(excerptOf(long, 50).endsWith("…")).toBe(true);
  });
});

describe("changes over 30 days", () => {
  test("a month ago counts what's new as unchanged, so adding a keyword isn't a gain", () => {
    const now = [
      { k: "a", v: 10 },
      { k: "b", v: 7 },
    ];
    expect(
      baseline(
        now,
        [{ k: "a", v: 4 }],
        (x) => x.k,
        (x) => x.v,
      ),
    ).toEqual([4, 7]);
    expect(
      baseline(
        now,
        [],
        (x) => x.k,
        (x) => x.v,
      ),
    ).toBeNull();
    expect(
      baseline(
        now,
        [{ k: "z", v: 1 }],
        (x) => x.k,
        (x) => x.v,
      ),
    ).toBeNull();
  });

  test("weekly series carry the last reading forward and start empty", () => {
    const now = Date.UTC(2026, 10, 20);
    const s = weekly([{ at: new Date(Date.UTC(2026, 10, 3)), key: "a", value: 5 }], (xs) => xs[0]!, now);
    expect(s.values).toHaveLength(13);
    expect(s.values.at(-1)).toBe(5);
    expect(s.values[0]).toBeNull();
  });
});

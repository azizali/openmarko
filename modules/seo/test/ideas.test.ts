import { describe, expect, test } from "bun:test";
import { isRelevant, keywordSeeds, mapsTerms, organicTerms, questionsFor, withoutPlace } from "../src/onboarding/ideas";

const pest = {
  categories: ["pest control service", "exterminator"],
  cities: ["austin", "round rock"],
  services: ["mice removal", "bee removal"],
};

describe("what Setup suggests", () => {
  test("seeds go beyond category + city: services, the bare words, near me", () => {
    const seeds = keywordSeeds(pest);
    expect(seeds).toContain("pest control service austin");
    expect(seeds).toContain("mice removal austin");
    expect(seeds).toContain("exterminator");
    expect(seeds).toContain("bee removal near me");
    expect(seeds).toContain("exterminator round rock");
    expect(new Set(seeds).size).toBe(seeds.length);
    expect(seeds.length).toBeLessThanOrEqual(16);
  });

  test("a cap cuts the least useful: every category keeps its first city", () => {
    const seeds = keywordSeeds(pest, 4);
    expect(seeds.slice(0, 2)).toEqual(["pest control service austin", "exterminator austin"]);
  });

  test("terms are kept when about the business, with or without a place", () => {
    expect(isRelevant("mice in attic", pest)).toBe(true);
    expect(isRelevant("bee hive removal", pest)).toBe(true);
    expect(isRelevant("plumber austin", pest)).toBe(true);
    expect(isRelevant("best pizza", pest)).toBe(false);
  });

  test("questions cover services, prices and the other places", () => {
    const q = questionsFor(pest, "Austin");
    expect(q[0]).toBe("Who is the best pest control service in Austin?");
    expect(q).toContain("How much does mice removal cost in Austin?");
    expect(q).toContain("Who is the best pest control service in round rock?");
  });

  test("Maps terms say what, not where: the grid already says where", () => {
    const geo = new Set(["austin", "tx", "round", "rock"]);
    expect(withoutPlace("exterminator austin tx", geo)).toBe("exterminator");
    const maps = mapsTerms(pest, ["mice exterminator austin", "how to get rid of bees in walls round rock tx"], geo);
    expect(maps).toContain("exterminator");
    expect(maps).toContain("mice removal near me");
    expect(maps).toContain("mice exterminator");
    expect(maps.filter((t) => /austin|round rock/.test(t))).toEqual([]);
    // A long question isn't how people search a map.
    expect(maps.some((t) => t.startsWith("how to get rid"))).toBe(false);
  });

  test("Google search terms name the place, in every city, plus the provider's long tail", () => {
    const organic = organicTerms(pest, ["how to get rid of mice in walls"]);
    expect(organic).toContain("mice removal round rock");
    expect(organic).toContain("best exterminator in austin");
    expect(organic).toContain("how to get rid of mice in walls");
  });
});

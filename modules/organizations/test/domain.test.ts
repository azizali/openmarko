import { describe, expect, test } from "bun:test";
import { domainOfLink, normalizeDomain } from "../src/domain";

describe("websites are audited per domain, never per page", () => {
  test("keeps only the host, lowercased, without www", () => {
    expect(normalizeDomain("https://www.MapleAndMain.com/about/")).toBe("mapleandmain.com");
    expect(normalizeDomain("mapleandmain.com")).toBe("mapleandmain.com");
  });

  test("rejects something that isn't a domain", () => {
    expect(() => normalizeDomain("not a domain")).toThrow();
    expect(() => normalizeDomain("localhost")).toThrow();
  });

  test("a Google Business Profile deep link reduces to its domain for audits", () => {
    expect(domainOfLink("https://mapleandmain.com/implants")).toBe("mapleandmain.com");
    expect(domainOfLink(null)).toBeNull();
    expect(domainOfLink("nonsense")).toBeNull();
  });
});

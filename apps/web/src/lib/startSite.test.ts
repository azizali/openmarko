import { describe, expect, test } from "bun:test";
import { cleanSite } from "./startSite";

describe("cleanSite", () => {
  test("keeps the address people type, without the scheme or a trailing slash", () => {
    expect(cleanSite("https://www.BrightSmileDental.com/")).toBe("www.brightsmiledental.com");
    expect(cleanSite("  joesplumbing.co.uk ")).toBe("joesplumbing.co.uk");
    expect(cleanSite("example.com/austin")).toBe("example.com/austin");
  });
  test("drops what can't be a web address", () => {
    expect(cleanSite(null)).toBeNull();
    expect(cleanSite("")).toBeNull();
    expect(cleanSite("joes plumbing")).toBeNull();
    expect(cleanSite("localhost")).toBeNull();
    expect(cleanSite("javascript:alert(1)")).toBeNull();
  });
});

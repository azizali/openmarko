import { describe, expect, test } from "bun:test";
import { providerOf } from "@openmarko/shared";
import { splitFieldValues } from "../src/fields";

const wordpress = providerOf("wordpress");

describe("connection values are checked against the provider's fields", () => {
  test("secret fields go to credentials, the rest to settings", () => {
    const out = splitFieldValues(wordpress, { siteUrl: "https://site.test", username: "u", appPassword: "p", seoPlugin: "yoast" });
    expect(out.secrets).toEqual({ appPassword: "p" });
    expect(out.settings).toEqual({ siteUrl: "https://site.test", username: "u", seoPlugin: "yoast" });
  });

  test("missing required fields, unknown keys and values outside the options are all reported", () => {
    try {
      splitFieldValues(wordpress, { siteUrl: "https://site.test", password: "x", seoPlugin: "allinone" });
      throw new Error("should have thrown");
    } catch (e) {
      const problems = (e as { details: { problems: string[] } }).details.problems;
      expect(problems).toContain("password: not a field of WordPress");
      expect(problems).toContain("username: required");
      expect(problems).toContain("appPassword: required");
      expect(problems).toContain("seoPlugin: must be one of none, yoast, rankmath");
    }
  });

  test("optional fields may be left out", () => {
    expect(() => splitFieldValues(wordpress, { siteUrl: "https://site.test", username: "u", appPassword: "p" })).not.toThrow();
  });
});

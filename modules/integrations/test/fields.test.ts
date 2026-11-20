import { describe, expect, test } from "bun:test";
import { providerOf } from "@app/shared";
import { splitFieldValues } from "../src/fields";

const mailgun = providerOf("mailgun")!;

describe("connection values are checked against the provider's fields", () => {
  test("secret fields go to credentials, the rest to settings", () => {
    const out = splitFieldValues(mailgun, { key: "k", domain: "mg.example.com", region: "EU" });
    expect(out.secrets).toEqual({ key: "k" });
    expect(out.settings).toEqual({ domain: "mg.example.com", region: "EU" });
  });

  test("missing required fields, unknown keys and values outside the options are all reported", () => {
    try {
      splitFieldValues(mailgun, { password: "x", region: "Mars" });
      throw new Error("should have thrown");
    } catch (e) {
      const problems = (e as { details: { problems: string[] } }).details.problems;
      expect(problems).toContain("password: not a field of Mailgun");
      expect(problems).toContain("key: required");
      expect(problems).toContain("domain: required");
      expect(problems).toContain("region: must be one of US, EU");
    }
  });

  test("optional fields may be left out", () => {
    expect(() => splitFieldValues(mailgun, { key: "k", domain: "mg.example.com" })).not.toThrow();
  });
});

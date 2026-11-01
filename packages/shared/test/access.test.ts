import { describe, expect, test } from "bun:test";
import { allows, allowsAll, compile, presets, reach, requireAllowed, type RoleSpec } from "../src";
import { AppError } from "@openmarko/kernel";

const preset = (id: string) => presets.find((p) => p.id === id)!;

describe("roles compile to permissions (ADR 0003)", () => {
  test("Owner gets everything, including owner-only actions", () => {
    const p = compile(preset("owner"));
    expect(allows(p, "organization", "delete")).toBe(true);
    expect(allows(p, "billing", "update")).toBe(true);
  });

  test("Admin can't delete the organization or change billing", () => {
    const p = compile(preset("admin"));
    expect(allows(p, "organization", "update")).toBe(true);
    expect(allows(p, "organization", "delete")).toBe(false);
    expect(allows(p, "billing", "update")).toBe(false);
  });

  test("Editor publishes but can't connect accounts or manage people", () => {
    const p = compile(preset("editor"));
    expect(allows(p, "reviews", "post")).toBe(true);
    expect(allows(p, "seo", "connect")).toBe(false);
    expect(allows(p, "member", "create")).toBe(false);
  });

  test("Viewer sees and changes nothing", () => {
    const p = compile(preset("viewer"));
    expect(allows(p, "reviews", "view")).toBe(true);
    expect(allows(p, "reviews", "post")).toBe(false);
    expect(reach(p, "reviews")).toBe("view");
  });

  test("a custom role can allow exact actions on one feature", () => {
    const spec: RoleSpec = {
      id: "front_desk",
      name: "Front desk",
      description: "",
      base: "none",
      groups: {},
      resources: { reviews: ["view", "reply"] },
    };
    const p = compile(spec);
    expect(allowsAll(p, { reviews: ["view", "reply"] })).toBe(true);
    expect(allows(p, "reviews", "post")).toBe(false);
  });

  test("requireAllowed throws a 403 that names the role", () => {
    const p = compile(preset("viewer"));
    try {
      requireAllowed({ role: "viewer", permission: p }, "reviews", "post");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).status).toBe(403);
      expect((e as AppError).message).toContain("viewer");
    }
  });
});

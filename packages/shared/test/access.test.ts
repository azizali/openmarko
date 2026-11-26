import { describe, expect, test } from "bun:test";
import { AppError, type AccessCatalog, type ResourceEntry } from "@app/kernel";
import { allows, allowsAll, compile, presets, reach, requireAllowed, statementOf, type RoleSpec } from "../src";

const preset = (id: string) => presets.find((p) => p.id === id)!;
const r = (module: string, id: string, group: string, actions: ResourceEntry["actions"]): ResourceEntry => ({
  module,
  id,
  label: id,
  group,
  actions,
});

// An app with the organization basics and one feature module.
const access: AccessCatalog = {
  groups: [
    { module: "identity", id: "organization", label: "Organization" },
    { module: "seo", id: "seo", label: "SEO" },
  ],
  resources: [
    r("identity", "organization", "organization", [
      { id: "update", label: "Change settings", tier: "manage" },
      { id: "delete", label: "Delete", tier: "manage", ownerOnly: true },
    ]),
    r("identity", "member", "organization", [{ id: "create", label: "Add people", tier: "manage" }]),
    r("billing", "billing", "organization", [
      { id: "view", label: "See plan", tier: "view" },
      { id: "update", label: "Change plan", tier: "manage", ownerOnly: true },
    ]),
    r("seo", "seo", "seo", [
      { id: "view", label: "See", tier: "view" },
      { id: "connect", label: "Connect", tier: "manage" },
    ]),
    r("seo", "reviews", "seo", [
      { id: "view", label: "Read", tier: "view" },
      { id: "reply", label: "Draft", tier: "edit" },
      { id: "post", label: "Post", tier: "publish" },
    ]),
  ],
};

describe("roles compile to permissions over the catalog (ADR 0003)", () => {
  test("Owner gets everything, including owner-only actions", () => {
    const p = compile(access, preset("owner"));
    expect(allows(p, "organization", "delete")).toBe(true);
    expect(allows(p, "billing", "update")).toBe(true);
  });

  test("Admin can't delete the organization or change billing", () => {
    const p = compile(access, preset("admin"));
    expect(allows(p, "organization", "update")).toBe(true);
    expect(allows(p, "organization", "delete")).toBe(false);
    expect(allows(p, "billing", "update")).toBe(false);
  });

  test("Editor publishes but can't connect accounts or manage people", () => {
    const p = compile(access, preset("editor"));
    expect(allows(p, "reviews", "post")).toBe(true);
    expect(allows(p, "seo", "connect")).toBe(false);
    expect(allows(p, "member", "create")).toBe(false);
  });

  test("Viewer sees and changes nothing", () => {
    const p = compile(access, preset("viewer"));
    expect(allows(p, "reviews", "view")).toBe(true);
    expect(allows(p, "reviews", "post")).toBe(false);
    expect(reach(access, p, "reviews")).toBe("view");
  });

  test("a custom role can allow exact actions on one resource", () => {
    const spec: RoleSpec = {
      id: "front_desk",
      name: "Front desk",
      description: "",
      base: "none",
      groups: {},
      resources: { reviews: ["view", "reply"] },
    };
    const p = compile(access, spec);
    expect(allowsAll(p, { reviews: ["view", "reply"] })).toBe(true);
    expect(allows(p, "reviews", "post")).toBe(false);
  });

  test("an app without a module gets none of its resources, whatever the Role says", () => {
    const withoutSeo: AccessCatalog = {
      groups: access.groups.filter((g) => g.module !== "seo"),
      resources: access.resources.filter((x) => x.module !== "seo"),
    };
    const spec: RoleSpec = {
      id: "x",
      name: "x",
      description: "",
      base: "manage",
      groups: { seo: "manage" },
      resources: { reviews: ["post"] },
    };
    const p = compile(withoutSeo, spec);
    expect(p.reviews).toBeUndefined();
    expect(Object.keys(statementOf(withoutSeo)).toSorted()).toEqual(["billing", "member", "organization"]);
  });

  test("requireAllowed throws a 403 that names the role", () => {
    const p = compile(access, preset("viewer"));
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

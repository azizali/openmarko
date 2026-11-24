// The tools modules offer the assistant are checked at boot (ADR 0036): named after their module, offered once, and
// needing a permission some enabled module declares.
import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { defineTool, loadConfig, type AssistantTool } from "@app/kernel";
import { checkedTools, moduleCatalog } from "../src";

const cfg = loadConfig({
  DATABASE_URL: "postgres://unused/unused",
  BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:3000",
  MASTER_KEY_V1: Buffer.alloc(32, 7).toString("base64"),
});
const catalog = moduleCatalog(cfg);

const read = (name: string, requires = { resource: "activity", action: "view" }): AssistantTool =>
  defineTool({
    name,
    description: "x",
    input: z.object({}),
    requires,
    effect: "read",
    run: async () => null,
  });
const check = (id: string, ...tools: AssistantTool[]) => checkedTools([{ id, tools }], catalog);

describe("tools offered to the assistant", () => {
  test("a well-formed tool is kept", () => {
    expect(check("automation", read("automation.recent_activity")).map((t) => t.name)).toEqual(["automation.recent_activity"]);
  });

  test("a tool is named after the module that offers it", () => {
    expect(() => check("automation", read("seo.overview"))).toThrow('must be named "automation.<verb_noun>"');
    expect(() => check("automation", read("automation.Recent"))).toThrow("must be named");
  });

  test("no tool is offered twice", () => {
    expect(() => check("automation", read("automation.a"), read("automation.a"))).toThrow("offered twice");
  });

  test("a tool needs a declared permission", () => {
    expect(() => check("automation", read("automation.a", { resource: "activity", action: "delete" }))).toThrow(
      "needs activity.delete, which no enabled module declares",
    );
  });
});

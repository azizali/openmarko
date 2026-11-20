// The edits the setup commands make, against the files as they're checked in.
import { describe, expect, test } from "bun:test";
import {
  githubRepo,
  patchAppConfig,
  patchDeployYml,
  patchPreDeploy,
  patchVercelJson,
  readEnv,
  slugify,
  upsertEnv,
  type DeployConfig,
} from "../lib/config-files";

const read = (path: string) => Bun.file(`${import.meta.dir}/../../${path}`).text();
const deploy: DeployConfig = {
  repo: "Jane/My-App",
  server: "198.51.100.7",
  sshUser: "deploy",
  apiDomain: "api.acme.dev",
  appDomain: "app.acme.dev",
  siteDomain: "www.acme.dev",
  adminEmail: "jane@acme.dev",
};

describe(".env", () => {
  test("fills a blank, uncomments a commented line, adds a missing one, and keeps comments", () => {
    const out = upsertEnv("# why\nA=\n# B=old\n", { A: "1", B: "2", C: "3" });
    expect(out).toBe("# why\nA=1\nB=2\nC=3\n");
    expect(readEnv(out)).toEqual({ A: "1", B: "2", C: "3" });
  });

  test("a value with $ in it goes in as written", () => {
    expect(upsertEnv("A=\n", { A: "x$&y$1" })).toBe("A=x$&y$1\n");
  });
});

describe("app.config.ts", () => {
  test("sets the name, the slug and each module, and leaves the features alone", async () => {
    const before = await read("app.config.ts");
    const out = patchAppConfig(before, {
      name: 'Acme "Pro"',
      slug: "acme",
      modules: { billing: false, partners: false, ai: true, knowledge: true, automation: false },
    });
    expect(out).toContain('name: "Acme \\"Pro\\"",');
    expect(out).toContain('slug: "acme",');
    expect(out).toMatch(/billing: false,/);
    expect(out).toMatch(/partners: false,/);
    expect(out).toMatch(/automation: false,/);
    expect(out).toMatch(/ai: true,/);
    expect(out).toContain('id: "assistant"');
  });
});

describe("the deploy files", () => {
  test("deploy.yml takes every value, and can be filled again with different answers", async () => {
    const once = patchDeployYml(await read("config/deploy.yml"), { ...deploy, server: "203.0.113.99", apiDomain: "old.acme.dev" }, "acme");
    const out = patchDeployYml(once, deploy, "acme");
    expect(out).toContain("service: acme\n");
    expect(out).toContain("image: jane/my-app\n");
    expect(out.match(/hosts: \[198\.51\.100\.7\]/g)).toHaveLength(2);
    expect(out).toContain("host: api.acme.dev\n");
    expect(out).toContain("username: jane\n");
    expect(out).toContain("BETTER_AUTH_URL: https://api.acme.dev\n");
    expect(out).toContain("APP_URL: https://app.acme.dev\n");
    expect(out).toContain("SITE_URL: https://www.acme.dev\n");
    expect(out).toContain("ADMIN_EMAILS: jane@acme.dev\n");
    expect(out).toMatch(/ssh:\n\s+user: deploy\n/);
    expect(out).not.toContain("old.acme.dev");
    expect(out).toContain("app_port: 3000"); // what isn't an answer stays
  });

  test("no site: SITE_URL is blank", async () => {
    expect(patchDeployYml(await read("config/deploy.yml"), { ...deploy, siteDomain: "" }, "acme")).toContain('SITE_URL: ""\n');
  });

  test("the pre-deploy hook names the image", async () => {
    expect(patchPreDeploy(await read(".kamal/hooks/pre-deploy"), deploy)).toContain('"ghcr.io/jane/my-app:${KAMAL_VERSION}"');
  });

  test("the web app forwards to the API's domain", async () => {
    const out = JSON.parse(patchVercelJson(await read("apps/web/vercel.json"), deploy));
    expect(out.rewrites[0].destination).toBe("https://api.acme.dev/api/:path*");
    expect(out.rewrites[1].destination).toBe("https://api.acme.dev/widget/:path*");
    expect(out.rewrites[2].destination).toBe("/index.html");
  });
});

test("slugs and GitHub remotes", () => {
  expect(slugify("My Great App!")).toBe("my-great-app");
  expect(slugify("123")).toBe("app");
  expect(githubRepo("git@github.com:jane/my-app.git")).toBe("jane/my-app");
  expect(githubRepo("https://github.com/jane/my.app")).toBe("jane/my.app");
  expect(githubRepo("https://gitlab.com/jane/my-app")).toBeNull();
});

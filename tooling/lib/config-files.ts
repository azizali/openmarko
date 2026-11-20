// Pure edits to the files `bun run setup` and `bun run deploy:setup` fill in. Each works on a known line of the file as
// it's checked in, so running again with new answers replaces the old ones.

export const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^[^a-z]+/, "")
    .slice(0, 40) || "app";

export function readEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m) out[m[1]!] = m[2]!;
  }
  return out;
}

/** Sets variables in a .env file: on their own line, or a commented-out one, else at the end. Comments stay. */
export function upsertEnv(text: string, values: Record<string, string>): string {
  let out = text;
  for (const [key, value] of Object.entries(values)) {
    const line = new RegExp(`^(?:# *)?${key}=.*$`, "m");
    out = line.test(out) ? out.replace(line, () => `${key}=${value}`) : `${out.replace(/\n*$/, "\n")}${key}=${value}\n`;
  }
  return out;
}

export type AppAnswers = { name: string; slug: string; modules: Record<string, boolean> };

export function patchAppConfig(text: string, a: AppAnswers): string {
  let out = text
    .replace(/^(\s*name: )".*?",$/m, (_, k) => `${k}${JSON.stringify(a.name)},`)
    .replace(/^(\s*slug: )".*?",$/m, (_, k) => `${k}"${a.slug}",`);
  for (const [id, on] of Object.entries(a.modules))
    out = out.replace(new RegExp(`^(\\s*${id}: )(true|false),$`, "m"), (_, k) => `${k}${on},`);
  return out;
}

/** Where the deploy goes. Committed as deploy.config.json; holds nothing secret. */
export type DeployConfig = {
  /** `owner/name` on GitHub. */
  repo: string;
  server: string;
  sshUser: string;
  apiDomain: string;
  appDomain: string;
  /** The marketing site's domain; empty for none. */
  siteDomain: string;
  adminEmail: string;
};

/** Registries want image names in lowercase; GitHub names needn't be. */
export const imageOf = (c: DeployConfig) => c.repo.toLowerCase();

const setYaml = (text: string, key: string, value: string) => text.replace(new RegExp(`^(\\s*${key}: ).*$`, "m"), (_, k) => `${k}${value}`);

export function patchDeployYml(text: string, c: DeployConfig, slug: string): string {
  let out = text.replace(/^(\s+hosts: )\[.*\]$/gm, (_, k) => `${k}[${c.server}]`);
  out = out.replace(/^(ssh:\n\s+user: ).*$/m, (_, k) => `${k}${c.sshUser}`);
  for (const [key, value] of [
    ["service", slug],
    ["image", imageOf(c)],
    ["host", c.apiDomain],
    ["username", imageOf(c).split("/")[0]!],
    ["BETTER_AUTH_URL", `https://${c.apiDomain}`],
    ["APP_URL", `https://${c.appDomain}`],
    ["SITE_URL", c.siteDomain ? `https://${c.siteDomain}` : '""'],
    ["ADMIN_EMAILS", c.adminEmail],
  ] as const)
    out = setYaml(out, key, value);
  return out;
}

export const patchPreDeploy = (text: string, c: DeployConfig): string =>
  text.replace(/"ghcr\.io\/[^:"]+:\$\{KAMAL_VERSION\}"/, () => `"ghcr.io/${imageOf(c)}:\${KAMAL_VERSION}"`);

export const patchVercelJson = (text: string, c: DeployConfig): string =>
  text.replace(/("destination": "https:\/\/)[^/"]+\//g, (_, k) => `${k}${c.apiDomain}/`);

/** `owner/name` from a GitHub remote, ssh or https; null for anything else. */
export function githubRepo(remote: string): string | null {
  return /github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/.exec(remote.trim())?.[1] ?? null;
}

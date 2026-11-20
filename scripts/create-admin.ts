// Makes an app admin: `bun run admin:create you@example.com [--name "You"] [--organization "Acme"] [--password ...]`.
// A verified account with a generated password, printed once, and an Organization to work in. Works against whatever
// DATABASE_URL points at, with sign-up open or closed. On an existing account it adds the role and leaves the password.
import { parseArgs } from "node:util";
import { appConfig, createAppContext, loadConfig } from "@app/kernel";
import { closeAuth, createAdminUser } from "@app/identity";
import { compose } from "@app/server";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { name: { type: "string" }, organization: { type: "string" }, password: { type: "string" }, json: { type: "boolean" } },
});
const email = positionals[0];
if (!email?.includes("@")) {
  console.error('Usage: bun run admin:create you@example.com [--name "You"] [--organization "Acme"] [--password ...]');
  process.exit(1);
}

const ctx = createAppContext(loadConfig());
compose(ctx);
ctx.enqueue = async () => {}; // nothing runs jobs here
const result = await createAdminUser(ctx, {
  email,
  name: values.name,
  password: values.password,
  organization: { name: values.organization ?? appConfig.name, slug: appConfig.slug },
});
await closeAuth(ctx);
await ctx.pool.end();

if (values.json) console.log(JSON.stringify(result));
else if (result.password) console.log(`${email} is an app admin.\nPassword (shown once): ${result.password}`);
else console.log(`${email} is an app admin. The account already existed, so its password didn't change.`);

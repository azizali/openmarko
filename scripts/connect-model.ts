// Connects one of the app's model vendors with a real key: `MODEL_API_KEY=... bun scripts/connect-model.ts anthropic [--default]`.
// The key comes from the environment so it never shows in a process list. The vendor is asked for its models first,
// so a key it refuses is never stored. `--default` also makes one of that vendor's small models the app's default.
// `bun run setup` and `bun run deploy:setup` call this; afterwards it's all in Admin → Models.
import { appConfig, createAppContext, loadConfig, moduleOn } from "@app/kernel";
import { connect, fetchVendorModels, providerOfVendor, vendors, type Vendor, type VendorModel } from "@app/integrations";
import { compose } from "@app/server";
import { readAppSetting, writeAppSetting } from "@app/settings";

const vendor = process.argv[2] as Vendor;
const apiKey = process.env.MODEL_API_KEY;
if (!vendors.includes(vendor) || !apiKey) {
  console.error(`Usage: MODEL_API_KEY=... bun scripts/connect-model.ts <${vendors.join("|")}> [--default]`);
  process.exit(1);
}

/** A small model is the right default for a new app. Ids sort oldest first, so the last match is the newest. */
function smallModel(models: VendorModel[]): VendorModel | undefined {
  const chat = models.filter((m) => m.kind === "chat");
  for (const small of [/claude.*haiku/, /-mini\b/, /flash/]) {
    const hit = chat.filter((m) => small.test(m.model)).at(-1);
    if (hit) return hit;
  }
  return chat[0];
}

let models: VendorModel[];
try {
  models = await fetchVendorModels(vendor, apiKey);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}

const ctx = createAppContext(loadConfig());
compose(ctx);
await connect(ctx, {
  organizationId: null,
  providerId: providerOfVendor[vendor],
  target: { type: "app", id: null },
  label: `${vendor} (${appConfig.name})`,
  secrets: { apiKey },
  mode: "live",
});
console.log(`${vendor} connected`);

const model = process.argv.includes("--default") && moduleOn(ctx, "ai") ? smallModel(models) : undefined;
if (model) {
  const current = (await readAppSetting<{ models?: Record<string, unknown> }>(ctx, "ai"))?.value;
  await writeAppSetting(ctx, "ai", { defaultModel: "fast", models: { ...current?.models, fast: { model: model.id } } });
  console.log(`default model: ${model.id}`);
}
await ctx.pool.end();

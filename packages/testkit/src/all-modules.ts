// Loaded before every test file (bunfig.toml). The tests are the spec for all the code in the repository, so they run
// with every optional module on: a fork that turns one off still proves what it keeps, and CI can still deploy it.
// That the core stands alone with the optional modules off is tested in packages/server/test/manifests.test.ts.
import { appConfig } from "../../../app.config";

for (const id of Object.keys(appConfig.modules)) (appConfig.modules as Record<string, boolean>)[id] = true;

import { siteAdapter } from "./adapter";
import { wordpressSite } from "./cms/wordpress";
import { customSite } from "./cms/custom";
import { webflowSite, shopifySite, ghostSite } from "./cms/hosted";

/** Every CMS the website capability can reach. Adding one = a spec here plus a catalog entry. */
export const siteSpecs = [wordpressSite, webflowSite, shopifySite, ghostSite, customSite];
export const siteAdapters = siteSpecs.map(siteAdapter);

/** Which optional modules this build has (app.config.ts, through vite.config.ts). Pages gate on the raw constants. */
export const modules = {
  billing: __MODULE_BILLING__,
  partners: __MODULE_PARTNERS__,
  ai: __MODULE_AI__,
  knowledge: __MODULE_KNOWLEDGE__,
  automation: __MODULE_AUTOMATION__,
  seo: __MODULE_SEO__,
} as const;

export const APP_NAME = __APP_NAME__;
export const FEATURES = __FEATURES__;

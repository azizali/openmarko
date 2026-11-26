// Build-time constants from vite.config.ts (app.config.ts). One per optional module, so `__MODULE_X__ && import(...)`
// drops a module's pages from the bundle when it's off.
declare const __MODULE_BILLING__: boolean;
declare const __MODULE_PARTNERS__: boolean;
declare const __MODULE_AI__: boolean;
declare const __MODULE_KNOWLEDGE__: boolean;
declare const __MODULE_AUTOMATION__: boolean;
declare const __MODULE_SEO__: boolean;
declare const __APP_NAME__: string;
declare const __FEATURES__: { id: string; label: string; description: string; module?: string }[];

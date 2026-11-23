import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { appConfig } from "../../app.config.ts";

// Each optional module becomes a build-time constant (__MODULE_BILLING__ and so on). Pages of a module that's off
// sit behind `__MODULE_X__ && import(...)`, so the bundler drops them: a module that's off never reaches the bundle.
const moduleFlags = Object.fromEntries(
  Object.entries(appConfig.modules).map(([id, on]) => [`__MODULE_${id.toUpperCase()}__`, JSON.stringify(on)]),
);

// In development the app forwards /api to the API on localhost:3000, as Vercel forwards it to the API's domain in
// production (vercel.json), so the session cookie is the app's own.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { ...moduleFlags, __APP_NAME__: JSON.stringify(appConfig.name), __FEATURES__: JSON.stringify(appConfig.features) },
  // MapLibre loads its worker from a file beside it (`new URL(..., import.meta.url)`); pre-bundled, that file goes
  // missing (an "outdated optimize dep" 504) and the map draws nothing. Served as published, the worker is found.
  optimizeDeps: { exclude: ["maplibre-gl"] },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "^/widget/": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});

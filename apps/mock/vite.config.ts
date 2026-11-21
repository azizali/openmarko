import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Its own port: the app (5173) and the site (5174) are the product, and must not be displaced by the mock.
  server: { port: 5175, strictPort: true },
});

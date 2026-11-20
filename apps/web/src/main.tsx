import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyTheme } from "./lib/theme";
import { loadBrand } from "./lib/brand";
import { rememberedOrg } from "./lib/session";
import "./index.css";

applyTheme();
// The brand (ours, or a Partner's) before the first paint, so nothing flashes.
await loadBrand(rememberedOrg());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

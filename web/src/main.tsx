import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { LocaleProvider } from "./components/locale-provider";
import { ThemeProvider } from "./components/theme-provider";
import { TooltipProvider } from "./components/ui/tooltip";
import { useStore } from "./store/useStore";
import "./index.css";

// Deep-linkable view: ?view=day|night sets the initial globe mode.
const view = new URLSearchParams(window.location.search).get("view");
if (view === "day" || view === "night") useStore.getState().setGlobeView(view);

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root non trovato");

createRoot(root).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark">
      <LocaleProvider>
        <TooltipProvider delayDuration={200}>
          <App />
        </TooltipProvider>
      </LocaleProvider>
    </ThemeProvider>
  </StrictMode>,
);

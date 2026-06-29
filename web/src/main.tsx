import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { useStore } from "./store/useStore";
import "./styles.css";

// Vista deep-linkabile: ?view=day|night imposta la modalità iniziale del globo.
const view = new URLSearchParams(window.location.search).get("view");
if (view === "day" || view === "night") useStore.getState().setGlobeView(view);

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root non trovato");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

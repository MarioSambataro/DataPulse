/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Vite + React per il frontend DataPulse (globo 3D R3F).
// `test` qui configura Vitest: ambiente `node` perché i test della SEZIONE 6
// sono funzioni pure (conversione geo, store) — nessun rendering WebGL in CI.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: { port: 5173 },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});

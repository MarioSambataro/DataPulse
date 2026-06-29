/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL del backend DataPulse (GET /events, /stats). Default dev: http://localhost:8000. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

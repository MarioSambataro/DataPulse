/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** DataPulse backend base URL. Development default: http://localhost:8000. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

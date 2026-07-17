# `web/` — DataPulse frontend

React, TypeScript, and Vite application featuring an interactive 3D Earth built
with react-three-fiber and Three.js.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run lint     # ESLint flat configuration and React hooks rules
npm run test     # Vitest unit tests
npm run build    # TypeScript project build and Vite production bundle
npm run e2e      # Playwright end-to-end tests
```

`VITE_API_URL` defaults to `http://localhost:8000` and points to the FastAPI
backend. Use `?mock=1` for a deterministic demo without API infrastructure.

## Structure

```text
src/
├─ main.tsx            # React entry point and URL-state bootstrap
├─ App.tsx             # Application shell and HUD
├─ styles.css          # Theme, responsive layout, and interface styles
├─ theme.ts            # Shared color tokens
├─ types.ts            # Frontend contract aligned with Pydantic models
├─ components/         # HUD, filters, status, details, and time controls
├─ hooks/              # API, status, statistics, and live-feed loaders
├─ lib/                # Pure data, geometry, filtering, and time utilities
├─ store/useStore.ts   # Lightweight global Zustand state
└─ three/              # Globe, camera, effects, event layers, and GLSL shaders
```

Texture sources and attribution are in [`public/textures/README.md`](public/textures/README.md).

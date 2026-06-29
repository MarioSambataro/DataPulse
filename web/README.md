# web/ — Frontend DataPulse

App **React + TypeScript + Vite** con globo terrestre **3D** (react-three-fiber /
three.js) in stile command-center tattico. Accenti ambra/ciano, sfondo scuro.

## Sviluppo

```bash
npm install
npm run dev      # http://localhost:5173 — globo 3D che ruota
npm run lint     # eslint (flat config, react-hooks)
npm run test     # vitest (funzioni pure: conversione geo)
npm run build    # tsc -b && vite build
```

`VITE_API_URL` (default `http://localhost:8000`) punta al backend FastAPI; i dati
reali (epicentri/vulcani da `GET /events`) vengono consumati nella **SEZIONE 7**.

## Struttura

```
src/
├─ main.tsx            # entry React
├─ App.tsx             # shell + HUD tattico (overlay)
├─ styles.css          # tema scuro, palette, HUD
├─ theme.ts            # palette ambra/ciano (TS + shader)
├─ types.ts            # contratto dati allineato all'API (Event/EventPage/Stats)
├─ lib/geo.ts          # (lat,lon) → Vec3 sulla sfera (testato)
├─ store/useStore.ts   # stato globale leggero (Zustand)
└─ three/
   ├─ Scene.tsx        # Canvas, luci, Stars, OrbitControls (auto-rotate + drag)
   ├─ Globe.tsx        # superficie texture (+ fallback procedurale) + griglia
   ├─ Atmosphere.tsx   # alone fresnel
   └─ shaders.ts       # GLSL (fresnel atmosfera, griglia lat/lon)
```

Texture in `public/textures/` (NASA, pubblico dominio) — vedi README lì.

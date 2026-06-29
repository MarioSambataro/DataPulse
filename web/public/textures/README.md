# Texture del globo

- `earth-map.jpg` — mappa diurna (continenti), usata scurita come base.
- `earth-night.jpg` — luci notturne delle città, usata come `emissiveMap` (glow ambra).

Immagini derivate da **NASA Visible Earth (Blue Marble / Black Marble)**, via
[Solar System Scope](https://www.solarsystemscope.com/textures/) — licenza
**CC BY 4.0** (attribuzione). Originali 8k ridimensionati a **4k** (4096×2048) e
ricompressi mozjpeg (~0.8 MB totali) per un bundle leggero senza perdere il
dettaglio delle luci città. Il globo ha un **fallback procedurale** (vedi
`src/three/Globe.tsx`) se le texture non sono disponibili.

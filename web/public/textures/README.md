# Texture del globo

- `earth-map-hd.jpg` — NASA Blue Marble Next Generation con topografia e batimetria, 5400×2700.
- `earth-night-hd.jpg` — NASA Earth at Night 2012 (Suomi NPP/VIIRS), 5760×2880.
- `earth-map.jpg` e `earth-night.jpg` — texture legacy mantenute come riserva.

Le texture HD attive provengono direttamente da NASA:
[Blue Marble](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/)
e [Earth at Night 2012](https://svs.gsfc.nasa.gov/30028/).

La sorgente notturna lossless è stata ricompressa in JPEG ad alta qualità,
senza sottocampionamento cromatico, per conservare il dettaglio delle luci
urbane mantenendo un peso adatto al web. Il globo usa un fallback procedurale
(vedi `src/three/Globe.tsx`) se le texture non sono disponibili.

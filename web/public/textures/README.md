# Globe textures

- `earth-map-hd.jpg` — NASA Blue Marble Next Generation with topography and bathymetry, 5400×2700.
- `earth-night-hd.jpg` — NASA Earth at Night 2012 (Suomi NPP/VIIRS), 5760×2880.
- `earth-map.jpg` and `earth-night.jpg` — legacy fallback textures.

The active high-resolution textures come directly from NASA:
[Blue Marble](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/)
and [Earth at Night 2012](https://svs.gsfc.nasa.gov/30028/).

The lossless night image was recompressed as a high-quality JPEG without chroma
subsampling to preserve city-light detail at a web-appropriate size. The globe
uses a procedural fallback from `src/three/Globe.tsx` when textures are unavailable.

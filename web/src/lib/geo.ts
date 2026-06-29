// Conversione coordinate geografiche → posizione 3D sulla superficie di una sfera.
// Funzione pura (nessuna dipendenza three) così è testabile in CI senza WebGL.
// È la base per posizionare epicentri/vulcani in SEZIONE 7.

export type Vec3 = [number, number, number];

export const degToRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Mappa (lat, lon) in gradi su un punto 3D di una sfera di raggio `radius`.
 *
 * Convenzione (allineata a una texture equirettangolare standard, Y = asse polare):
 *   phi   = (90 - lat) → colatitudine [0..180]
 *   theta = (lon + 180) → longitudine [0..360]
 *   x = -r·sin(phi)·cos(theta)
 *   y =  r·cos(phi)
 *   z =  r·sin(phi)·sin(theta)
 *
 * Proprietà: |result| === radius; polo nord (lat=90) → (0, r, 0).
 */
export function latLonToVec3(lat: number, lon: number, radius = 1): Vec3 {
  const phi = degToRad(90 - lat);
  const theta = degToRad(lon + 180);
  const sinPhi = Math.sin(phi);
  return [
    -radius * sinPhi * Math.cos(theta),
    radius * Math.cos(phi),
    radius * sinPhi * Math.sin(theta),
  ];
}

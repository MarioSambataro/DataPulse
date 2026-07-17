// Convert geographic coordinates to a 3D sphere position without Three.js dependencies.

export type Vec3 = [number, number, number];

export const degToRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Map degree coordinates to a point on a sphere with the given radius.
 *
 * Convention aligned with a standard equirectangular texture and Y polar axis:
 *   phi   = (90 - lat) → colatitudine [0..180]
 *   theta = (lon + 180) → longitudine [0..360]
 *   x = -r·sin(phi)·cos(theta)
 *   y =  r·cos(phi)
 *   z =  r·sin(phi)·sin(theta)
 *
 * Invariant: result length equals radius; the north pole maps to (0, r, 0).
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

// Pure approximation of the subsolar point used to orient globe lighting.

export interface SubsolarPoint {
  lat: number; // Solar declination [-23.44 .. +23.44].
  lon: number; // Solar-noon longitude [-180 .. 180].
}

const DAY_MS = 86_400_000;

/**
 * Approximate the subsolar point with enough accuracy for a visual terminator.
 * Declination follows a seasonal cosine; longitude follows UTC solar noon.
 */
export function subsolarPoint(date: Date = new Date()): SubsolarPoint {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear =
    (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - startOfYear) /
    DAY_MS;
  const lat = -23.44 * Math.cos((2 * Math.PI * (dayOfYear + 10)) / 365.24);

  const hoursUtc =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const lon = ((12 - hoursUtc) * 15 + 540) % 360 - 180;

  return { lat, lon };
}

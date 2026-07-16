// Posizione del punto subsolare (dove il sole è allo zenit) a partire dall'ora
// UTC corrente. Funzione pura (niente three) → testabile in CI senza WebGL.
// Serve a orientare luce direzionale e atmosfera così il terminatore giorno/notte
// sul globo corrisponde a "adesso" nel mondo reale.

export interface SubsolarPoint {
  lat: number; // declinazione solare [-23.44 .. +23.44]
  lon: number; // longitudine del mezzogiorno solare [-180 .. 180]
}

const DAY_MS = 86_400_000;

/**
 * Punto subsolare approssimato (errore < ~2° ignorando l'equazione del tempo,
 * più che sufficiente per un terminatore visivamente credibile).
 *  - declinazione: -23.44° · cos(2π · (N+10) / 365.24), N = giorno dell'anno;
 *  - longitudine: il sole è allo zenit dove è mezzogiorno solare, quindi
 *    lon = (12 − oraUTC) · 15°/h, normalizzata in [-180, 180].
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

// Derivazione client-side delle statistiche (GET /stats) dagli eventi già
// caricati. Usata in modalità ?mock=1 (niente endpoint /stats) e come fallback se
// la chiamata reale a /stats fallisce, così il pannello SITREP è sempre popolato.
// Replica le finestre rolling 24h/7g dell'API (api/queries.compute_stats).

import type { Event, Stats } from "../types";

const DAY_MS = 86_400_000;

/** Calcola gli aggregati 24h/7g dagli eventi in memoria (finestre rolling su now). */
export function deriveStats(events: Event[], now: Date = new Date()): Stats {
  const t = now.getTime();
  const since24h = t - DAY_MS;
  const since7d = t - 7 * DAY_MS;

  let events24h = 0;
  let events7d = 0;
  let earthquakes24h = 0;
  let maxMag24h: number | null = null;
  const activeVolcanoes = new Set<string>();

  for (const ev of events) {
    const ts = Date.parse(ev.occurred_at);
    if (Number.isNaN(ts)) continue;

    if (ts >= since7d) events7d += 1;
    if (ts >= since24h) {
      events24h += 1;
      if (ev.event_type === "earthquake") {
        earthquakes24h += 1;
        if (ev.magnitude != null && (maxMag24h == null || ev.magnitude > maxMag24h)) {
          maxMag24h = ev.magnitude;
        }
      }
    }
    if (ev.event_type === "volcano" && ts >= since7d) {
      // Stessa semantica dell'API: numero GVP distinto; fallback all'id se assente.
      const num = ev.meta?.volcano_number;
      activeVolcanoes.add(typeof num === "string" || typeof num === "number" ? String(num) : ev.id);
    }
  }

  return {
    generated_at: now.toISOString(),
    events_24h: events24h,
    events_7d: events7d,
    earthquakes_24h: earthquakes24h,
    max_magnitude_24h: maxMag24h,
    active_volcanoes_7d: activeVolcanoes.size,
  };
}

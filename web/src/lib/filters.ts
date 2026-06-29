// Filtro eventi CLIENT-SIDE: unica fonte di verità usata dal layer 3D
// (EventsLayer), dal ticker e dai contatori dell'HUD (SEZIONE 8).
//
// Scelta (PROGRESS): filtri solo lato client sugli eventi già caricati →
// istantaneo, niente flicker, niente chiamate extra. `minMagnitude` si applica
// SOLO ai terremoti, così i vulcani (magnitudo null) restano visibili in modalità
// "all" — al contrario del filtro API `min_magnitude`, che li escluderebbe.

import type { Event, Filters, TimeWindow } from "../types";

const DAY_MS = 86_400_000;

/** Inizio (epoch ms) della finestra temporale, o `null` se "all" (nessun limite). */
export function timeWindowStart(timeWindow: TimeWindow, now: number): number | null {
  if (timeWindow === "24h") return now - DAY_MS;
  if (timeWindow === "7d") return now - 7 * DAY_MS;
  return null;
}

/** Applica i filtri UI a una lista di eventi (ordine preservato). */
export function filterEvents(events: Event[], filters: Filters, now: number = Date.now()): Event[] {
  const start = timeWindowStart(filters.timeWindow, now);
  const out: Event[] = [];
  for (const ev of events) {
    if (filters.eventType !== "all" && ev.event_type !== filters.eventType) continue;
    // La magnitudo minima riguarda solo i terremoti: i vulcani passano sempre.
    if (ev.event_type === "earthquake" && (ev.magnitude ?? 0) < filters.minMagnitude) continue;
    if (start != null) {
      const ts = Date.parse(ev.occurred_at);
      if (!Number.isNaN(ts) && ts < start) continue;
    }
    out.push(ev);
  }
  return out;
}

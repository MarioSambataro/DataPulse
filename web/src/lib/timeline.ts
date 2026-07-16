// Logica pura del time-travel (playback): finestre, avanzamento del playhead,
// selezione degli eventi visibili a un dato istante. Nessuna dipendenza three/react
// → testabile in CI (come lib/geo, lib/filters).

import type { Event } from "../types";

/** Velocità di riproduzione: moltiplicatore tempo-dati / tempo-reale. */
export const PLAYBACK_SPEEDS = [
  { label: "30m/s", value: 1_800 },
  { label: "1h/s", value: 3_600 },
  { label: "6h/s", value: 21_600 },
  { label: "24h/s", value: 86_400 },
] as const;

/** Durante il playback, un sisma forte proietta l'onda d'urto se è "appena
 *  accaduto" rispetto al playhead: finestra di coda di 12 ore. */
export const REPLAY_SHOCKWAVE_WINDOW_MS = 12 * 3_600_000;

/** Estremi temporali (epoch ms) degli eventi caricati, o null se lista vuota. */
export function eventsTimeRange(events: Event[]): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const ev of events) {
    const ts = Date.parse(ev.occurred_at);
    if (Number.isNaN(ts)) continue;
    if (ts < min) min = ts;
    if (ts > max) max = ts;
  }
  return min <= max ? { min, max } : null;
}

/** Eventi già accaduti al playhead (occurred_at <= playhead). */
export function eventsUpTo(events: Event[], playhead: number): Event[] {
  return events.filter((ev) => {
    const ts = Date.parse(ev.occurred_at);
    return !Number.isNaN(ts) && ts <= playhead;
  });
}

/** Eventi accaduti nella finestra `[playhead - windowMs, playhead]`. */
export function eventsInTrailingWindow(
  events: Event[],
  playhead: number,
  windowMs: number,
): Event[] {
  const start = playhead - windowMs;
  return events.filter((ev) => {
    const ts = Date.parse(ev.occurred_at);
    return !Number.isNaN(ts) && ts >= start && ts <= playhead;
  });
}

/**
 * Avanza il playhead di `dtMs` reali alla velocità data, clampando a `endMs`.
 * `ended` segnala che la riproduzione ha raggiunto la fine (torna al live).
 */
export function advancePlayhead(
  playhead: number,
  speed: number,
  dtMs: number,
  endMs: number,
): { playhead: number; ended: boolean } {
  const next = playhead + dtMs * speed;
  if (next >= endMs) return { playhead: endMs, ended: true };
  return { playhead: next, ended: false };
}

/** Etichetta compatta del playhead per la barra (data+ora locale, senza secondi). */
export function formatPlayhead(playheadMs: number, locale = "it-IT"): string {
  return new Date(playheadMs).toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

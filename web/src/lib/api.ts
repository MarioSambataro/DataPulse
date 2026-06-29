// Data fetching dall'API DataPulse. Backend configurabile via VITE_API_URL
// (default dev: http://localhost:8000). SEZIONE 7: fetch one-shot di GET /events
// (envelope EventPage). SEZIONE 8: + GET /stats e polling periodico (120s).

import type { EventPage, Stats } from "../types";

/** Base URL del backend, senza slash finale. */
export const API_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

/** Quanti eventi caricare sul globo (= MAX_LIMIT lato API). InstancedMesh regge senza problemi. */
export const EVENTS_LIMIT = 1000;

/**
 * Intervallo di polling/refresh dei dati (eventi + stats). Scelta: 120s — i cron
 * ETL sono orario (terremoti) / giornaliero (vulcani), quindi i dati cambiano
 * lentamente; 120s dà un feel "live" senza martellare il backend.
 */
export const POLL_INTERVAL_MS = 120_000;

/**
 * Modalità mock per screenshot/demo senza DB+API: `?mock=1` carica un fixture
 * statico da `public/mock-events.json` (stesso envelope EventPage). Opt-in, non
 * tocca il percorso reale. In mock non esiste endpoint /stats → le stat si derivano
 * dagli eventi caricati (lib/stats.deriveStats).
 */
export function isMockMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("mock") === "1";
}

/** Scarica gli eventi più recenti (envelope EventPage). Lancia su risposta non-2xx. */
export async function fetchEvents(signal?: AbortSignal): Promise<EventPage> {
  const url = isMockMode()
    ? `${import.meta.env.BASE_URL}mock-events.json`
    : `${API_BASE}/events?order=desc&limit=${EVENTS_LIMIT}`;

  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`GET /events → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as EventPage;
}

/** Scarica gli aggregati 24h/7g (GET /stats). Lancia su non-2xx. Non chiamato in mock. */
export async function fetchStats(signal?: AbortSignal): Promise<Stats> {
  const res = await fetch(`${API_BASE}/stats`, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`GET /stats → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as Stats;
}

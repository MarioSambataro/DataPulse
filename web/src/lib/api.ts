// Data fetching dall'API DataPulse. Backend configurabile via VITE_API_URL
// (default dev: http://localhost:8000). In SEZIONE 7 facciamo un fetch one-shot
// di GET /events (envelope EventPage); polling/refresh periodico → SEZIONE 8.

import type { EventPage } from "../types";

/** Base URL del backend, senza slash finale. */
export const API_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

/** Quanti eventi caricare sul globo (= MAX_LIMIT lato API). InstancedMesh regge senza problemi. */
export const EVENTS_LIMIT = 1000;

/**
 * Sorgente mock per screenshot/demo senza DB+API: `?mock=1` carica un fixture
 * statico da `public/mock-events.json` (stesso envelope EventPage). Opt-in, non
 * tocca il percorso reale.
 */
function mockRequested(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("mock") === "1";
}

/** Scarica gli eventi più recenti (envelope EventPage). Lancia su risposta non-2xx. */
export async function fetchEvents(signal?: AbortSignal): Promise<EventPage> {
  const url = mockRequested()
    ? `${import.meta.env.BASE_URL}mock-events.json`
    : `${API_BASE}/events?order=desc&limit=${EVENTS_LIMIT}`;

  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`GET /events → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as EventPage;
}

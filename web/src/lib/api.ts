// Data fetching dall'API DataPulse. Backend configurabile via VITE_API_URL
// (default dev: http://localhost:8000). SEZIONE 7: fetch one-shot di GET /events
// (envelope EventPage). SEZIONE 8: + GET /stats e polling periodico (120s).
// SEZIONE 12: + feed live SSE, GET /status, endpoint AI (/ai/query, /ai/briefing).

import type { AiBriefing, AiQueryResult, ApiStatus, Event, EventPage, Stats } from "../types";

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

/** GET /events con parametri arbitrari (usato dalla modalità AI). */
export async function fetchEventsWithParams(
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<EventPage> {
  const qs = new URLSearchParams({ order: "desc", limit: String(EVENTS_LIMIT), ...params });
  const res = await fetch(`${API_BASE}/events?${qs}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`GET /events → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as EventPage;
}

/** GET /status: osservabilità (DB, freschezza dati ETL, uptime). */
export async function fetchStatus(signal?: AbortSignal): Promise<ApiStatus> {
  const res = await fetch(`${API_BASE}/status`, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`GET /status → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as ApiStatus;
}

/**
 * POST /ai/query: domanda in linguaggio naturale → filtri di GET /events.
 * 503 = backend senza DEEPSEEK_API_KEY (l'UI mostra "AI non configurata").
 */
export async function aiQuery(question: string, signal?: AbortSignal): Promise<AiQueryResult> {
  const res = await fetch(`${API_BASE}/ai/query`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ question }),
  });
  if (res.status === 503) throw new AiUnavailableError();
  if (!res.ok) {
    throw new Error(`POST /ai/query → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as AiQueryResult;
}

/** GET /ai/briefing: SITREP sintetico generato dai dati reali (cache 15 min lato API). */
export async function fetchBriefing(signal?: AbortSignal): Promise<AiBriefing> {
  const res = await fetch(`${API_BASE}/ai/briefing`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (res.status === 503) throw new AiUnavailableError();
  if (!res.ok) {
    throw new Error(`GET /ai/briefing → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as AiBriefing;
}

/** Il backend non ha una DEEPSEEK_API_KEY configurata: funzioni AI da nascondere. */
export class AiUnavailableError extends Error {
  constructor() {
    super("AI non configurata sul backend");
    this.name = "AiUnavailableError";
  }
}

/**
 * Apre il feed live SSE (`GET /events/stream`). Ritorna la funzione di chiusura.
 * `EventSource` fa retry da solo (il server manda `retry: 5000`); onLive segnala
 * lo stato della connessione per il badge LIVE.
 */
export function openEventStream(
  onEvents: (events: Event[]) => void,
  onLive: (connected: boolean) => void,
): () => void {
  const es = new EventSource(`${API_BASE}/events/stream`);
  es.onopen = () => onLive(true);
  es.onerror = () => onLive(false); // EventSource riprova da solo
  es.addEventListener("events", (msg) => {
    try {
      const parsed = JSON.parse((msg as MessageEvent).data) as Event[];
      if (Array.isArray(parsed) && parsed.length > 0) onEvents(parsed);
    } catch {
      // payload malformato: ignora il frame, il feed continua
    }
  });
  return () => {
    es.close();
    onLive(false);
  };
}

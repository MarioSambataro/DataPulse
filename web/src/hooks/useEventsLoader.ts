// Hook di caricamento eventi: al mount fa un fetch di GET /events e poi un
// refresh periodico (polling, POLL_INTERVAL_MS). Popola lo store (setEvents) ed
// espone lo stato per l'HUD.
//
// Niente flicker: il primo caricamento mostra "loading"; i refresh successivi sono
// silenziosi (lo stato resta "ready") e si limitano a rimpiazzare gli eventi nello
// store. Se un refresh fallisce ma abbiamo già dati, restiamo "ready" (non si
// sbandiera FEED OFFLINE su un buco transitorio); l'errore diventa visibile solo
// se è il primo caricamento a fallire.
//
// SEZIONE 12 — feed live SSE: in parallelo al polling (che resta come rete di
// sicurezza) si apre `GET /events/stream`; i nuovi eventi ingeriti arrivano in
// push e vengono fusi nello store (mergeEvents), il badge diventa LIVE.
// In modalità AI (aiMode) né il polling né l'SSE toccano lo store: il globo sta
// mostrando il risultato della query e non va sovrascritto.

import { useEffect, useState } from "react";

import { POLL_INTERVAL_MS, fetchEvents, isMockMode, openEventStream } from "../lib/api";
import { useStore } from "../store/useStore";

// Render Free può impiegare circa un minuto a riattivare il container. Durante
// il cold start manteniamo lo stato "loading" e ritentiamo con backoff, invece
// di mostrare subito un falso "feed offline" a chi apre la demo portfolio.
const INITIAL_RETRY_DELAYS_MS = [3_000, 5_000, 8_000, 12_000, 15_000, 20_000];

function waitForRetry(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

async function fetchInitialEvents(signal: AbortSignal) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= INITIAL_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await fetchEvents(signal);
    } catch (error) {
      if (signal.aborted) throw error;
      lastError = error;
      const delay = INITIAL_RETRY_DELAYS_MS[attempt];
      if (delay == null) break;
      await waitForRetry(delay, signal);
    }
  }
  throw lastError;
}

export type LoadStatus = "loading" | "ready" | "error";

export interface EventsLoadState {
  status: LoadStatus;
  error: string | null;
  count: number;
}

export function useEventsLoader(): EventsLoadState {
  const setEvents = useStore((s) => s.setEvents);
  const count = useStore((s) => s.events.length);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | null = null;
    let hasData = false;

    const load = async (initial: boolean) => {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      if (initial) {
        setStatus("loading");
        setError(null);
      }
      try {
        const page = initial ? await fetchInitialEvents(signal) : await fetchEvents(signal);
        if (cancelled || signal.aborted) return;
        // In modalità AI il globo mostra il risultato della query: non sovrascrivere.
        if (!useStore.getState().aiMode) setEvents(page.items);
        hasData = true;
        setStatus("ready");
        setError(null);
      } catch (err: unknown) {
        if (cancelled || signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        // Refresh fallito con dati già presenti → resta "ready" (no flicker/offline).
        if (!hasData) setStatus("error");
      }
    };

    void load(true);
    const id = window.setInterval(() => void load(false), POLL_INTERVAL_MS);

    // Feed live SSE (non in mock: non c'è backend). EventSource fa retry da solo.
    let closeStream: (() => void) | null = null;
    if (!isMockMode()) {
      const { mergeEvents, setLive } = useStore.getState();
      closeStream = openEventStream(
        (incoming) => {
          if (!useStore.getState().aiMode) mergeEvents(incoming);
        },
        (connected) => setLive(connected),
      );
    }

    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(id);
      closeStream?.();
    };
  }, [setEvents]);

  return { status, error, count };
}

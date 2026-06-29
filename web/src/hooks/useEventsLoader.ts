// Hook di caricamento eventi: al mount fa un fetch di GET /events e poi un
// refresh periodico (polling, POLL_INTERVAL_MS). Popola lo store (setEvents) ed
// espone lo stato per l'HUD.
//
// Niente flicker: il primo caricamento mostra "loading"; i refresh successivi sono
// silenziosi (lo stato resta "ready") e si limitano a rimpiazzare gli eventi nello
// store. Se un refresh fallisce ma abbiamo già dati, restiamo "ready" (non si
// sbandiera FEED OFFLINE su un buco transitorio); l'errore diventa visibile solo
// se è il primo caricamento a fallire.

import { useEffect, useState } from "react";

import { POLL_INTERVAL_MS, fetchEvents } from "../lib/api";
import { useStore } from "../store/useStore";

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
        const page = await fetchEvents(signal);
        if (cancelled || signal.aborted) return;
        setEvents(page.items);
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

    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(id);
    };
  }, [setEvents]);

  return { status, error, count };
}

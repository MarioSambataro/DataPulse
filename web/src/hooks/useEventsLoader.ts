// Hook di caricamento eventi: al mount fa un fetch one-shot di GET /events e
// popola lo store (setEvents), esponendo stato loading/errore per l'HUD.
// Il refresh periodico (polling) sarà aggiunto in SEZIONE 8.

import { useEffect, useState } from "react";

import { fetchEvents } from "../lib/api";
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
    const controller = new AbortController();
    setStatus("loading");
    setError(null);

    fetchEvents(controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;
        setEvents(page.items);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });

    return () => controller.abort();
  }, [setEvents]);

  return { status, error, count };
}

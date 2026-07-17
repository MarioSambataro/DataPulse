// Load events with initial fetching, silent polling, and SSE updates. Existing
// data survives transient refresh failures, and AI mode freezes its filtered set.

import { useEffect, useState } from "react";

import { POLL_INTERVAL_MS, fetchEvents, isMockMode, openEventStream } from "../lib/api";
import { useStore } from "../store/useStore";

// Render cold starts may take about a minute, so initial loading retries with backoff.
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
        // Do not overwrite an AI-filtered dataset.
        if (!useStore.getState().aiMode) setEvents(page.items);
        hasData = true;
        setStatus("ready");
        setError(null);
      } catch (err: unknown) {
        if (cancelled || signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        // Keep existing data ready after a failed refresh.
        if (!hasData) setStatus("error");
      }
    };

    void load(true);
    const id = window.setInterval(() => void load(false), POLL_INTERVAL_MS);

    // Open SSE outside mock mode; EventSource retries automatically.
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

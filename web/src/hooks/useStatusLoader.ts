// Poll API status and measure latency; mock mode has no backend status.

import { useEffect, useState } from "react";

import { fetchStatus, isMockMode } from "../lib/api";
import type { ApiStatus } from "../types";

const STATUS_POLL_MS = 60_000;

export interface StatusLoadState {
  status: ApiStatus | null;
  latencyMs: number | null;
  error: boolean;
}

export function useStatusLoader(): StatusLoadState {
  const [state, setState] = useState<StatusLoadState>({
    status: null,
    latencyMs: null,
    error: false,
  });

  useEffect(() => {
    if (isMockMode()) return;
    let cancelled = false;
    let controller: AbortController | null = null;

    const load = async () => {
      controller?.abort();
      controller = new AbortController();
      const started = performance.now();
      try {
        const status = await fetchStatus(controller.signal);
        if (cancelled) return;
        setState({ status, latencyMs: performance.now() - started, error: false });
      } catch {
        if (cancelled) return;
        setState((prev) => ({ ...prev, error: true }));
      }
    };

    void load();
    const id = window.setInterval(() => void load(), STATUS_POLL_MS);
    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(id);
    };
  }, []);

  return state;
}

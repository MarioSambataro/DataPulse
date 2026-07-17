// Load rolling statistics from the API, with client-derived mock and outage fallback.

import { useEffect, useMemo, useState } from "react";

import { POLL_INTERVAL_MS, fetchStats, isMockMode } from "../lib/api";
import { deriveStats } from "../lib/stats";
import { useStore } from "../store/useStore";
import type { Stats } from "../types";

export type StatsStatus = "loading" | "ready" | "error";
export type StatsSource = "api" | "derived";

export interface StatsLoadState {
  stats: Stats | null;
  status: StatsStatus;
  source: StatsSource;
}

export function useStatsLoader(): StatsLoadState {
  const events = useStore((s) => s.events);
  const mock = isMockMode();

  const [apiStats, setApiStats] = useState<Stats | null>(null);
  const [apiError, setApiError] = useState(false);

  // Recompute fallback statistics whenever in-memory events change.
  const derived = useMemo(() => (events.length ? deriveStats(events) : null), [events]);

  useEffect(() => {
    if (mock) return; // Mock mode uses derived values only.
    let cancelled = false;
    let controller: AbortController | null = null;

    const load = async () => {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      try {
        const s = await fetchStats(signal);
        if (cancelled || signal.aborted) return;
        setApiStats(s);
        setApiError(false);
      } catch {
        if (cancelled || signal.aborted) return;
        setApiError(true); // Derived values remain available.
      }
    };

    void load();
    const id = window.setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(id);
    };
  }, [mock]);

  // Prefer API values and fall back to derived statistics.
  if (mock || apiError || !apiStats) {
    const status: StatsStatus = derived ? "ready" : mock ? "loading" : apiError ? "error" : "loading";
    return { stats: derived, status, source: "derived" };
  }
  return { stats: apiStats, status: "ready", source: "api" };
}

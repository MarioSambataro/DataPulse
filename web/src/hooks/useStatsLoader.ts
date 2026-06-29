// Hook delle statistiche 24h/7g per il pannello SITREP.
//
// - Modalità reale: GET /stats al mount + polling (POLL_INTERVAL_MS). In caso di
//   errore ricade sulle stat derivate dagli eventi in store (fallback).
// - Modalità ?mock=1: niente endpoint /stats → sempre derivate dagli eventi.
//
// `source` distingue stat reali ("api") da derivate ("derived"), così il pannello
// può mostrare un tag MOCK/OFFLINE senza nascondere i numeri.

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

  // Stat derivate dagli eventi in memoria (fallback / mock). Ricalcolate quando
  // cambiano gli eventi (ad ogni refresh del polling eventi).
  const derived = useMemo(() => (events.length ? deriveStats(events) : null), [events]);

  useEffect(() => {
    if (mock) return; // niente fetch: solo derivate
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
        setApiError(true); // i numeri restano dai derivati
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

  // Risoluzione: API reale > derivate. Lo status riflette se i numeri sono pronti.
  if (mock || apiError || !apiStats) {
    const status: StatsStatus = derived ? "ready" : mock ? "loading" : apiError ? "error" : "loading";
    return { stats: derived, status, source: "derived" };
  }
  return { stats: apiStats, status: "ready", source: "api" };
}

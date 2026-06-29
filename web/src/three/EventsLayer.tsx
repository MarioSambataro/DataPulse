import { useMemo } from "react";

import { useStore } from "../store/useStore";
import type { Event } from "../types";
import { Epicenters } from "./Epicenters";
import { Volcanoes } from "./Volcanoes";

/**
 * Layer dati sul globo: legge gli eventi e i filtri dallo store, li separa per
 * tipo e li affida ai due renderer specializzati (epicentri istanziati + vulcani).
 * I controlli dei filtri arrivano in SEZIONE 8; qui rispettiamo già i default dello
 * store (eventType="all", minMagnitude=0), così il layer è pronto a riceverli.
 */
export function EventsLayer({ radius }: { radius: number }) {
  const events = useStore((s) => s.events);
  const filters = useStore((s) => s.filters);
  const select = useStore((s) => s.select);

  const { earthquakes, volcanoes } = useMemo(() => {
    const eq: Event[] = [];
    const vo: Event[] = [];
    for (const ev of events) {
      if (ev.event_type === "earthquake") {
        if (filters.eventType === "volcano") continue;
        if ((ev.magnitude ?? 0) < filters.minMagnitude) continue;
        eq.push(ev);
      } else if (ev.event_type === "volcano") {
        if (filters.eventType === "earthquake") continue;
        vo.push(ev);
      }
    }
    return { earthquakes: eq, volcanoes: vo };
  }, [events, filters.eventType, filters.minMagnitude]);

  return (
    <group>
      <Epicenters events={earthquakes} radius={radius} onSelect={select} />
      <Volcanoes events={volcanoes} radius={radius} onSelect={select} />
    </group>
  );
}

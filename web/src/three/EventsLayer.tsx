import { useMemo } from "react";

import { filterEvents } from "../lib/filters";
import { useStore } from "../store/useStore";
import type { Event } from "../types";
import { Epicenters } from "./Epicenters";
import { Volcanoes } from "./Volcanoes";

/**
 * Layer dati sul globo: legge gli eventi e i filtri dallo store, applica il filtro
 * client-side condiviso (`filterEvents`) e separa per tipo per i due renderer
 * specializzati (epicentri istanziati + vulcani). I controlli HUD scrivono i
 * `filters` nello store (SEZIONE 8) e il globo si aggiorna da solo.
 */
export function EventsLayer({ radius }: { radius: number }) {
  const events = useStore((s) => s.events);
  const filters = useStore((s) => s.filters);
  const select = useStore((s) => s.select);

  const { earthquakes, volcanoes } = useMemo(() => {
    const eq: Event[] = [];
    const vo: Event[] = [];
    for (const ev of filterEvents(events, filters)) {
      if (ev.event_type === "earthquake") eq.push(ev);
      else if (ev.event_type === "volcano") vo.push(ev);
    }
    return { earthquakes: eq, volcanoes: vo };
  }, [events, filters]);

  return (
    <group>
      <Epicenters events={earthquakes} radius={radius} onSelect={select} />
      <Volcanoes events={volcanoes} radius={radius} onSelect={select} />
    </group>
  );
}

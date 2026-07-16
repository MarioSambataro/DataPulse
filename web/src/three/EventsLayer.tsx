import { useMemo } from "react";

import { filterEvents } from "../lib/filters";
import { REPLAY_SHOCKWAVE_WINDOW_MS, eventsInTrailingWindow, eventsUpTo } from "../lib/timeline";
import { useStore } from "../store/useStore";
import type { Event } from "../types";
import { Epicenters } from "./Epicenters";
import { Shockwaves } from "./Shockwaves";
import { Volcanoes } from "./Volcanoes";

// Sopra questa magnitudo il sisma proietta anche un'onda d'urto di superficie.
const SHOCKWAVE_MIN_MAG = 5.5;

/**
 * Layer dati sul globo: legge gli eventi e i filtri dallo store, applica il filtro
 * client-side condiviso (`filterEvents`) e separa per tipo per i due renderer
 * specializzati (epicentri istanziati + vulcani). I controlli HUD scrivono i
 * `filters` nello store (SEZIONE 8) e il globo si aggiorna da solo.
 *
 * Time-travel (SEZIONE 12): con un playhead attivo il "presente" del globo è il
 * playhead — si vedono solo gli eventi già accaduti a quell'istante e le onde
 * d'urto si accendono per i sismi forti appena "ri-accaduti" (finestra di coda),
 * così lo sciame si rianima mentre la timeline scorre.
 */
export function EventsLayer({ radius }: { radius: number }) {
  const events = useStore((s) => s.events);
  const filters = useStore((s) => s.filters);
  const playhead = useStore((s) => s.playback.playhead);
  const select = useStore((s) => s.select);

  const { earthquakes, volcanoes, strong } = useMemo(() => {
    const now = playhead ?? Date.now();
    const pool = playhead != null ? eventsUpTo(events, playhead) : events;
    const eq: Event[] = [];
    const vo: Event[] = [];
    let st: Event[] = [];
    for (const ev of filterEvents(pool, filters, now)) {
      if (ev.event_type === "earthquake") {
        eq.push(ev);
        if (playhead == null && (ev.magnitude ?? 0) >= SHOCKWAVE_MIN_MAG) st.push(ev);
      } else if (ev.event_type === "volcano") vo.push(ev);
    }
    if (playhead != null) {
      // In playback l'onda si attiva quando il playhead attraversa l'evento.
      st = eventsInTrailingWindow(eq, playhead, REPLAY_SHOCKWAVE_WINDOW_MS).filter(
        (ev) => (ev.magnitude ?? 0) >= SHOCKWAVE_MIN_MAG,
      );
    }
    return { earthquakes: eq, volcanoes: vo, strong: st };
  }, [events, filters, playhead]);

  return (
    <group>
      <Epicenters events={earthquakes} radius={radius} onSelect={select} />
      <Volcanoes events={volcanoes} radius={radius} onSelect={select} />
      {/* Onde d'urto di superficie sui sismi forti (decorative, sopra i ping). */}
      <Shockwaves events={strong} radius={radius} />
    </group>
  );
}

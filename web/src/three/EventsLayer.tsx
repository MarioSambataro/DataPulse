import { useMemo } from "react";

import { filterEvents } from "../lib/filters";
import { REPLAY_SHOCKWAVE_WINDOW_MS, eventsInTrailingWindow, eventsUpTo } from "../lib/timeline";
import { useStore } from "../store/useStore";
import type { Event } from "../types";
import { Epicenters } from "./Epicenters";
import { Shockwaves } from "./Shockwaves";
import { Volcanoes } from "./Volcanoes";

// Earthquakes above this magnitude also project a surface shockwave.
const SHOCKWAVE_MIN_MAG = 5.5;

/**
 * Globe data layer that reads events and filters from the store.
 * Shared client filtering separates event types for the two specialized renderers.
 * Specialized children render instanced epicentres and volcanoes.
 *
 * Replay treats the playhead as the globe's present and reactivates recent strong
 * earthquake shockwaves as the timeline advances.
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
      // During replay, the wave activates as the playhead crosses the event.
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
      {/* Decorative strong-earthquake surface shockwaves above the pings. */}
      <Shockwaves events={strong} radius={radius} />
    </group>
  );
}

// Pannello filtri: tipo evento, magnitudo minima (slider), finestra temporale.
// Scrive nello store (setFilters) → il layer 3D, il ticker e i contatori si
// aggiornano da soli (filtro client-side condiviso, lib/filters.filterEvents).

import { useMemo } from "react";

import { filterEvents } from "../lib/filters";
import { useStore } from "../store/useStore";
import type { EventType, TimeWindow } from "../types";

const TYPE_OPTIONS: { value: EventType | "all"; label: string }[] = [
  { value: "all", label: "ALL" },
  { value: "earthquake", label: "SEISMIC" },
  { value: "volcano", label: "VOLCANIC" },
];

const WINDOW_OPTIONS: { value: TimeWindow; label: string }[] = [
  { value: "24h", label: "24H" },
  { value: "7d", label: "7D" },
  { value: "all", label: "ALL" },
];

export function FiltersPanel() {
  const events = useStore((s) => s.events);
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);

  const shown = useMemo(() => filterEvents(events, filters).length, [events, filters]);

  return (
    <section className="panel filters-panel" aria-label="Filtri">
      <header className="panel-head">
        <span className="panel-title">FILTERS</span>
        <span className="panel-tag dim">
          {shown}/{events.length}
        </span>
      </header>

      <div className="filter-row">
        <span className="filter-label">TYPE</span>
        <div className="seg" role="group" aria-label="Tipo evento">
          {TYPE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`seg-btn ${filters.eventType === o.value ? "on" : ""}`}
              onClick={() => setFilters({ eventType: o.value })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-row">
        <span className="filter-label">
          MIN MAG
          <strong className={filters.eventType === "volcano" ? "muted" : ""}>
            {filters.minMagnitude.toFixed(1)}
          </strong>
        </span>
        <input
          className="slider"
          type="range"
          min={0}
          max={8}
          step={0.5}
          value={filters.minMagnitude}
          disabled={filters.eventType === "volcano"}
          onChange={(e) => setFilters({ minMagnitude: Number(e.target.value) })}
          aria-label="Magnitudo minima"
        />
        {filters.eventType === "volcano" && (
          <span className="filter-note">n/a · volcanoes have no magnitude</span>
        )}
      </div>

      <div className="filter-row">
        <span className="filter-label">WINDOW</span>
        <div className="seg" role="group" aria-label="Finestra temporale">
          {WINDOW_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`seg-btn ${filters.timeWindow === o.value ? "on" : ""}`}
              onClick={() => setFilters({ timeWindow: o.value })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

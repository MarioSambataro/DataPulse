// Ticker eventi live: marquee orizzontale lungo il bordo inferiore con gli ultimi
// eventi (rispetta i filtri attivi). Auto-scroll continuo (in pausa su hover);
// click su una riga → seleziona l'evento (riusa select/selectedId + DetailPanel +
// SelectionMarker sul globo). Niente flicker: lista derivata dallo store.

import { useMemo } from "react";

import { timeAgo } from "../lib/format";
import { filterEvents } from "../lib/filters";
import { useStore } from "../store/useStore";
import type { Event } from "../types";

// Quanti eventi (più recenti) scorrere nel ticker.
const MAX_ITEMS = 40;

function TickerItem({ ev, selected, onSelect }: { ev: Event; selected: boolean; onSelect: (id: string) => void }) {
  const isQuake = ev.event_type === "earthquake";
  return (
    <button
      type="button"
      className={`ticker-item ${isQuake ? "quake" : "volcano"} ${selected ? "sel" : ""}`}
      onClick={() => onSelect(ev.id)}
      title={ev.title}
    >
      <span className="ti-icon">{isQuake ? "◉" : "▲"}</span>
      {isQuake && <span className="ti-mag">M{ev.magnitude?.toFixed(1) ?? "?"}</span>}
      <span className="ti-place">{ev.place ?? ev.title}</span>
      <span className="ti-time">{timeAgo(ev.occurred_at)}</span>
    </button>
  );
}

export function EventTicker() {
  const events = useStore((s) => s.events);
  const filters = useStore((s) => s.filters);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);

  // Eventi già ordinati desc dall'API; applichiamo i filtri e tagliamo a MAX_ITEMS.
  const items = useMemo(() => filterEvents(events, filters).slice(0, MAX_ITEMS), [events, filters]);

  if (items.length === 0) {
    return (
      <div className="ticker empty" aria-label="Ticker eventi">
        <span className="ticker-label">LIVE FEED</span>
        <span className="ticker-none">NO EVENTS IN VIEW</span>
      </div>
    );
  }

  // Velocità proporzionale al numero di item per uno scorrimento costante.
  const duration = Math.max(24, items.length * 3.4);

  return (
    <div className="ticker" aria-label="Ticker eventi live">
      <span className="ticker-label">LIVE FEED</span>
      <div className="ticker-viewport">
        <div className="ticker-track" style={{ animationDuration: `${duration}s` }}>
          {/* Lista duplicata per il loop continuo senza stacco. */}
          {[0, 1].map((dup) =>
            items.map((ev) => (
              <TickerItem
                key={`${dup}:${ev.id}`}
                ev={ev}
                selected={ev.id === selectedId}
                onSelect={select}
              />
            )),
          )}
        </div>
      </div>
    </div>
  );
}

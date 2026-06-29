// Pannello dettaglio minimale dell'evento selezionato (DOM, sopra il Canvas).
// Mostra magnitudo, profondità, ora, luogo. Si apre al click su un evento del
// globo (selectedId nello store) e si chiude con ✕ o tasto Esc.

import { useEffect } from "react";

import { useStore } from "../store/useStore";

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function DetailPanel() {
  const selectedId = useStore((s) => s.selectedId);
  const events = useStore((s) => s.events);
  const select = useStore((s) => s.select);

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, select]);

  if (!selectedId) return null;
  const event = events.find((e) => e.id === selectedId);
  if (!event) return null;

  const isQuake = event.event_type === "earthquake";

  return (
    <aside className="detail-panel" aria-live="polite">
      <header className="dp-head">
        <span className={`dp-kind ${isQuake ? "quake" : "volcano"}`}>
          {isQuake ? "● SEISMIC" : "▲ VOLCANIC"}
        </span>
        <button type="button" className="dp-close" onClick={() => select(null)} aria-label="Chiudi">
          ✕
        </button>
      </header>

      <h2 className="dp-title">{event.title}</h2>

      <dl className="dp-grid">
        {isQuake && (
          <>
            <div>
              <dt>MAGNITUDE</dt>
              <dd className="dp-mag">{event.magnitude?.toFixed(1) ?? "—"}</dd>
            </div>
            <div>
              <dt>DEPTH</dt>
              <dd>{event.depth_km != null ? `${event.depth_km.toFixed(0)} km` : "—"}</dd>
            </div>
          </>
        )}
        <div>
          <dt>PLACE</dt>
          <dd>{event.place ?? "—"}</dd>
        </div>
        <div>
          <dt>TIME (UTC)</dt>
          <dd>{formatTime(event.occurred_at)}</dd>
        </div>
        <div>
          <dt>COORDS</dt>
          <dd>
            {event.lat.toFixed(2)}°, {event.lon.toFixed(2)}°
          </dd>
        </div>
      </dl>
    </aside>
  );
}

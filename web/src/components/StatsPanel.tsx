// Pannello SITREP: statistiche 24h/7g da GET /stats (o derivate in mock/offline).
// Layout a griglia 2×2 nello stile command-center. Gestisce loading/errore.

import { useStatsLoader } from "../hooks/useStatsLoader";

function Metric({ label, value, accent }: { label: string; value: string; accent?: "amber" }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className={`metric-value ${accent ?? ""}`}>{value}</span>
    </div>
  );
}

export function StatsPanel() {
  const { stats, status, source } = useStatsLoader();

  let tag: { text: string; cls: string } | null = null;
  if (source === "derived") {
    tag =
      status === "error"
        ? { text: "OFFLINE", cls: "warn" }
        : { text: "DERIVED", cls: "dim" };
  }

  return (
    <section className="panel stats-panel" aria-label="Statistiche 24 ore">
      <header className="panel-head">
        <span className="panel-title">SITREP · 24H</span>
        {tag && <span className={`panel-tag ${tag.cls}`}>{tag.text}</span>}
      </header>

      {status === "loading" ? (
        <div className="panel-msg">ACQUIRING…</div>
      ) : status === "error" && !stats ? (
        <div className="panel-msg warn">STATS UNAVAILABLE</div>
      ) : (
        <div className="metric-grid">
          <Metric label="SEISMIC 24H" value={String(stats?.earthquakes_24h ?? 0)} />
          <Metric
            label="MAX MAG 24H"
            value={stats?.max_magnitude_24h != null ? stats.max_magnitude_24h.toFixed(1) : "—"}
            accent="amber"
          />
          <Metric label="EVENTS 7D" value={String(stats?.events_7d ?? 0)} />
          <Metric label="VOLCANOES 7D" value={String(stats?.active_volcanoes_7d ?? 0)} />
        </div>
      )}
    </section>
  );
}

// Contratto dati del frontend, allineato ai modelli Pydantic dell'API
// (api/schemas.py). I dati reali arrivano in SEZIONE 7; qui i tipi servono
// allo store e alla futura chiamata a GET /events (envelope EventPage) e /stats.

export type Source = "usgs" | "gvp";
export type EventType = "earthquake" | "volcano";

/** Evento unificato esposto da GET /events. L'API espone lat/lon (mai geom). */
export interface Event {
  id: string;
  source: Source;
  event_type: EventType;
  occurred_at: string; // ISO 8601 UTC
  lat: number;
  lon: number;
  depth_km: number | null;
  magnitude: number | null;
  severity: number | null; // 0..1, per size/colore del rendering
  title: string;
  place: string | null;
  meta: Record<string, unknown>;
  ingested_at: string | null;
}

/** Envelope paginato di GET /events. */
export interface EventPage {
  items: Event[];
  total: number;
  limit: number;
  offset: number;
}

/** Aggregati di GET /stats (finestre rolling 24h/7g). */
export interface Stats {
  generated_at: string;
  events_24h: number;
  events_7d: number;
  earthquakes_24h: number;
  max_magnitude_24h: number | null;
  active_volcanoes_7d: number;
}

/** Filtri lato UI (applicati al globo + futura query API in SEZIONE 8). */
export interface Filters {
  eventType: EventType | "all";
  minMagnitude: number;
}

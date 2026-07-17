// Frontend data contract aligned with the Pydantic models in api/schemas.py.

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
  severity: number | null; // Normalized 0..1 rendering size/color input.
  title: string;
  place: string | null;
  meta: Record<string, unknown>;
  ingested_at: string | null;
}

/** Paginated GET /events envelope. */
export interface EventPage {
  items: Event[];
  total: number;
  limit: number;
  offset: number;
}

/** Rolling 24-hour and 7-day GET /stats aggregates. */
export interface Stats {
  generated_at: string;
  events_24h: number;
  events_7d: number;
  earthquakes_24h: number;
  max_magnitude_24h: number | null;
  active_volcanoes_7d: number;
}

/** GET /status response covering database health and ETL freshness. */
export interface ApiStatus {
  status: "ok" | "degraded";
  version: string;
  uptime_s: number;
  db: "ok" | "error";
  last_ingested_at: string | null;
  last_event_age_s: number | null;
  events_total: number | null;
}

/** GET /events filter subset produced by POST /ai/query. */
export interface AiFilters {
  event_type: EventType | null;
  min_magnitude: number | null;
  start: string | null;
  end: string | null;
  near_lat: number | null;
  near_lon: number | null;
  radius_km: number | null;
}

/** POST /ai/query response. */
export interface AiQueryResult {
  answer: string;
  filters: AiFilters;
  model: string;
}

/** GET /ai/briefing response. */
export interface AiBriefing {
  briefing: string;
  generated_at: string;
  model: string;
  cached: boolean;
}

/** Rolling occurred_at filter window relative to the current time. */
export type TimeWindow = "24h" | "7d" | "all";

/** Client-side UI filters applied to the globe, ticker, and counters. */
export interface Filters {
  eventType: EventType | "all";
  minMagnitude: number;
  timeWindow: TimeWindow;
}

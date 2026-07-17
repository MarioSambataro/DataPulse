// Frontend data layer for REST, status, AI, and live SSE endpoints.

import type { AiBriefing, AiQueryResult, ApiStatus, Event, EventPage, Stats } from "../types";

/** Backend base URL without a trailing slash. */
export const API_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

/** Maximum events loaded on the globe, aligned with the API maximum. */
export const EVENTS_LIMIT = 1000;

/**
 * Events and statistics polling interval. ETL changes data relatively slowly,
 * so two minutes feels live without unnecessary backend traffic.
 */
export const POLL_INTERVAL_MS = 120_000;

/**
 * Mock mode loads a static EventPage fixture for screenshots and E2E tests.
 * Statistics are derived client-side because no mock backend exists.
 */
export function isMockMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("mock") === "1";
}

/** Fetch the latest EventPage and throw on a non-success response. */
export async function fetchEvents(signal?: AbortSignal): Promise<EventPage> {
  const url = isMockMode()
    ? `${import.meta.env.BASE_URL}mock-events.json`
    : `${API_BASE}/events?order=desc&limit=${EVENTS_LIMIT}`;

  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`GET /events → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as EventPage;
}

/** Fetch rolling statistics; mock mode derives them locally instead. */
export async function fetchStats(signal?: AbortSignal): Promise<Stats> {
  const res = await fetch(`${API_BASE}/stats`, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`GET /stats → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as Stats;
}

/** Fetch GET /events with arbitrary parameters, primarily for AI mode. */
export async function fetchEventsWithParams(
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<EventPage> {
  const qs = new URLSearchParams({ order: "desc", limit: String(EVENTS_LIMIT), ...params });
  const res = await fetch(`${API_BASE}/events?${qs}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`GET /events → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as EventPage;
}

/** Fetch database health, ETL freshness, and API uptime. */
export async function fetchStatus(signal?: AbortSignal): Promise<ApiStatus> {
  const res = await fetch(`${API_BASE}/status`, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`GET /status → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as ApiStatus;
}

/**
 * Translate a natural-language question into GET /events filters.
 */
export async function aiQuery(question: string, signal?: AbortSignal): Promise<AiQueryResult> {
  const res = await fetch(`${API_BASE}/ai/query`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ question }),
  });
  if (res.status === 503) throw new AiUnavailableError();
  if (!res.ok) {
    throw new Error(`POST /ai/query → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as AiQueryResult;
}

/** Fetch the concise AI SITREP generated from real data and cached by the API. */
export async function fetchBriefing(signal?: AbortSignal): Promise<AiBriefing> {
  const res = await fetch(`${API_BASE}/ai/briefing`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (res.status === 503) throw new AiUnavailableError();
  if (!res.ok) {
    throw new Error(`GET /ai/briefing → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as AiBriefing;
}

/** Signals that AI features are unavailable because the backend has no API key. */
export class AiUnavailableError extends Error {
  constructor() {
    super("AI is not configured on the backend");
    this.name = "AiUnavailableError";
  }
}

/**
 * Open the live SSE feed and return its cleanup function. EventSource retries
 * automatically; onLive drives the connection badge.
 */
export function openEventStream(
  onEvents: (events: Event[]) => void,
  onLive: (connected: boolean) => void,
): () => void {
  const es = new EventSource(`${API_BASE}/events/stream`);
  es.onopen = () => onLive(true);
  es.onerror = () => onLive(false); // EventSource retries automatically.
  es.addEventListener("events", (msg) => {
    try {
      const parsed = JSON.parse((msg as MessageEvent).data) as Event[];
      if (Array.isArray(parsed) && parsed.length > 0) onEvents(parsed);
    } catch {
      // Ignore one malformed frame and keep the feed alive.
    }
  });
  return () => {
    es.close();
    onLive(false);
  };
}

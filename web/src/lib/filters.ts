// Shared client-side filtering for the 3D layer, ticker, and HUD. Magnitude
// applies only to earthquakes, keeping volcanoes visible.

import type { Event, Filters, TimeWindow } from "../types";

const DAY_MS = 86_400_000;

/** Start of the rolling time window in epoch milliseconds, or null for all time. */
export function timeWindowStart(timeWindow: TimeWindow, now: number): number | null {
  if (timeWindow === "24h") return now - DAY_MS;
  if (timeWindow === "7d") return now - 7 * DAY_MS;
  return null;
}

/** Apply UI filters while preserving event order. */
export function filterEvents(events: Event[], filters: Filters, now: number = Date.now()): Event[] {
  const start = timeWindowStart(filters.timeWindow, now);
  const out: Event[] = [];
  for (const ev of events) {
    if (filters.eventType !== "all" && ev.event_type !== filters.eventType) continue;
    // Minimum magnitude affects earthquakes only.
    if (ev.event_type === "earthquake" && (ev.magnitude ?? 0) < filters.minMagnitude) continue;
    if (start != null) {
      const ts = Date.parse(ev.occurred_at);
      if (!Number.isNaN(ts) && ts < start) continue;
    }
    out.push(ev);
  }
  return out;
}

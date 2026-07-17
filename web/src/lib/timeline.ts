// Pure replay utilities for ranges, playhead advancement, and visible events.

import type { Event } from "../types";

/** Replay speed as a data-time to real-time multiplier. */
export const PLAYBACK_SPEEDS = [
  { label: "30m/s", value: 1_800 },
  { label: "1h/s", value: 3_600 },
  { label: "6h/s", value: 21_600 },
  { label: "24h/s", value: 86_400 },
] as const;

/** Strong earthquakes retain a shockwave for 12 data hours after the playhead passes. */
export const REPLAY_SHOCKWAVE_WINDOW_MS = 12 * 3_600_000;

/** Epoch-millisecond bounds for loaded events, or null for an empty list. */
export function eventsTimeRange(events: Event[]): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const ev of events) {
    const ts = Date.parse(ev.occurred_at);
    if (Number.isNaN(ts)) continue;
    if (ts < min) min = ts;
    if (ts > max) max = ts;
  }
  return min <= max ? { min, max } : null;
}

/** Events that have occurred by the current playhead. */
export function eventsUpTo(events: Event[], playhead: number): Event[] {
  return events.filter((ev) => {
    const ts = Date.parse(ev.occurred_at);
    return !Number.isNaN(ts) && ts <= playhead;
  });
}

/** Events within `[playhead - windowMs, playhead]`. */
export function eventsInTrailingWindow(
  events: Event[],
  playhead: number,
  windowMs: number,
): Event[] {
  const start = playhead - windowMs;
  return events.filter((ev) => {
    const ts = Date.parse(ev.occurred_at);
    return !Number.isNaN(ts) && ts >= start && ts <= playhead;
  });
}

/**
 * Advance the playhead by real elapsed time at the selected speed and clamp it.
 * `ended` signals that replay reached the end and should return to live mode.
 */
export function advancePlayhead(
  playhead: number,
  speed: number,
  dtMs: number,
  endMs: number,
): { playhead: number; ended: boolean } {
  const next = playhead + dtMs * speed;
  if (next >= endMs) return { playhead: endMs, ended: true };
  return { playhead: next, ended: false };
}

/** Compact local date-and-time label for the replay bar. */
export function formatPlayhead(playheadMs: number, locale = "it-IT"): string {
  return new Date(playheadMs).toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

import { describe, expect, it } from "vitest";

import {
  advancePlayhead,
  eventsInTrailingWindow,
  eventsTimeRange,
  eventsUpTo,
} from "./timeline";
import type { Event } from "../types";

const T0 = Date.parse("2026-07-01T00:00:00Z");
const HOUR = 3_600_000;

function ev(id: string, offsetHours: number): Event {
  return {
    id,
    source: "usgs",
    event_type: "earthquake",
    occurred_at: new Date(T0 + offsetHours * HOUR).toISOString(),
    lat: 0,
    lon: 0,
    depth_km: 10,
    magnitude: 5,
    severity: 0.5,
    title: id,
    place: null,
    meta: {},
    ingested_at: null,
  };
}

describe("eventsTimeRange", () => {
  it("ritorna min/max sugli occurred_at", () => {
    const range = eventsTimeRange([ev("a", 5), ev("b", 1), ev("c", 3)]);
    expect(range).toEqual({ min: T0 + HOUR, max: T0 + 5 * HOUR });
  });

  it("null su lista vuota o date invalide", () => {
    expect(eventsTimeRange([])).toBeNull();
    expect(eventsTimeRange([{ ...ev("x", 0), occurred_at: "boh" }])).toBeNull();
  });
});

describe("eventsUpTo", () => {
  it("include solo eventi già accaduti al playhead (bordo incluso)", () => {
    const events = [ev("a", 1), ev("b", 2), ev("c", 3)];
    const visible = eventsUpTo(events, T0 + 2 * HOUR);
    expect(visible.map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("eventsInTrailingWindow", () => {
  it("finestra di coda [playhead-w, playhead]", () => {
    const events = [ev("old", 0), ev("in", 4), ev("edge", 5), ev("future", 7)];
    const got = eventsInTrailingWindow(events, T0 + 5 * HOUR, 2 * HOUR);
    expect(got.map((e) => e.id)).toEqual(["in", "edge"]);
  });
});

describe("advancePlayhead", () => {
  it("avanza di dt*speed", () => {
    // 100 ms reali a 3600x → 360 s di dati
    const { playhead, ended } = advancePlayhead(T0, 3600, 100, T0 + HOUR);
    expect(playhead).toBe(T0 + 360_000);
    expect(ended).toBe(false);
  });

  it("clampa alla fine e segnala ended", () => {
    const end = T0 + HOUR;
    const { playhead, ended } = advancePlayhead(T0, 86_400, 60_000, end);
    expect(playhead).toBe(end);
    expect(ended).toBe(true);
  });
});

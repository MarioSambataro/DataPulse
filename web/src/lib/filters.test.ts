import { describe, expect, it } from "vitest";

import type { Event, Filters } from "../types";
import { filterEvents, timeWindowStart } from "./filters";

const NOW = Date.parse("2026-06-29T12:00:00Z");

function ev(over: Partial<Event>): Event {
  return {
    id: over.id ?? "x",
    source: "usgs",
    event_type: "earthquake",
    occurred_at: "2026-06-29T11:00:00Z",
    lat: 0,
    lon: 0,
    depth_km: null,
    magnitude: 5,
    severity: 0.5,
    title: "t",
    place: null,
    meta: {},
    ingested_at: null,
    ...over,
  };
}

const base: Filters = { eventType: "all", minMagnitude: 0, timeWindow: "all" };

describe("timeWindowStart", () => {
  it("'all' → nessun limite", () => {
    expect(timeWindowStart("all", NOW)).toBeNull();
  });
  it("24h e 7d → finestre rolling corrette", () => {
    expect(timeWindowStart("24h", NOW)).toBe(NOW - 86_400_000);
    expect(timeWindowStart("7d", NOW)).toBe(NOW - 7 * 86_400_000);
  });
});

describe("filterEvents", () => {
  it("'all' senza filtri → passa tutto", () => {
    const events = [ev({ id: "a" }), ev({ id: "b", event_type: "volcano", magnitude: null })];
    expect(filterEvents(events, base, NOW)).toHaveLength(2);
  });

  it("eventType filtra per tipo", () => {
    const events = [ev({ id: "q" }), ev({ id: "v", event_type: "volcano", magnitude: null })];
    expect(filterEvents(events, { ...base, eventType: "volcano" }, NOW).map((e) => e.id)).toEqual([
      "v",
    ]);
  });

  it("minMagnitude esclude i terremoti deboli ma NON i vulcani (mag null)", () => {
    const events = [
      ev({ id: "weak", magnitude: 2 }),
      ev({ id: "strong", magnitude: 6 }),
      ev({ id: "volcano", event_type: "volcano", magnitude: null }),
    ];
    const out = filterEvents(events, { ...base, minMagnitude: 4 }, NOW).map((e) => e.id);
    expect(out).toEqual(["strong", "volcano"]);
  });

  it("timeWindow esclude gli eventi fuori finestra", () => {
    const events = [
      ev({ id: "recent", occurred_at: "2026-06-29T06:00:00Z" }),
      ev({ id: "old", occurred_at: "2026-06-20T00:00:00Z" }),
    ];
    expect(filterEvents(events, { ...base, timeWindow: "24h" }, NOW).map((e) => e.id)).toEqual([
      "recent",
    ]);
    expect(filterEvents(events, { ...base, timeWindow: "7d" }, NOW).map((e) => e.id)).toEqual([
      "recent",
    ]);
  });
});

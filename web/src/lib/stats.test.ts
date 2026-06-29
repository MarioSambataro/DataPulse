import { describe, expect, it } from "vitest";

import type { Event } from "../types";
import { deriveStats } from "./stats";

const NOW = new Date("2026-06-29T12:00:00Z");

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

describe("deriveStats", () => {
  it("conta le finestre 24h/7g e la max magnitudo", () => {
    const events = [
      ev({ id: "a", occurred_at: "2026-06-29T06:00:00Z", magnitude: 4 }),
      ev({ id: "b", occurred_at: "2026-06-29T10:00:00Z", magnitude: 6.2 }),
      ev({ id: "c", occurred_at: "2026-06-26T00:00:00Z", magnitude: 7 }), // dentro 7g, fuori 24h
      ev({ id: "d", occurred_at: "2026-06-10T00:00:00Z", magnitude: 8 }), // fuori 7g
    ];
    const s = deriveStats(events, NOW);
    expect(s.events_24h).toBe(2);
    expect(s.events_7d).toBe(3);
    expect(s.earthquakes_24h).toBe(2);
    expect(s.max_magnitude_24h).toBe(6.2); // ignora il M7 fuori 24h
  });

  it("max magnitudo null se nessun terremoto in 24h", () => {
    const events = [ev({ event_type: "volcano", magnitude: null, occurred_at: "2026-06-29T09:00:00Z" })];
    const s = deriveStats(events, NOW);
    expect(s.earthquakes_24h).toBe(0);
    expect(s.max_magnitude_24h).toBeNull();
  });

  it("vulcani attivi 7g = numeri GVP distinti (fallback id)", () => {
    const events = [
      ev({ id: "v1", event_type: "volcano", magnitude: null, meta: { volcano_number: "211060" } }),
      ev({ id: "v2", event_type: "volcano", magnitude: null, meta: { volcano_number: "211060" } }), // stesso vulcano
      ev({ id: "v3", event_type: "volcano", magnitude: null, meta: {} }), // senza numero → id
    ];
    expect(deriveStats(events, NOW).active_volcanoes_7d).toBe(2);
  });
});

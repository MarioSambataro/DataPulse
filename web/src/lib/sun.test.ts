import { describe, expect, it } from "vitest";

import { subsolarPoint } from "./sun";

describe("subsolarPoint", () => {
  it("places the March-equinox noon sun near zero latitude and longitude", () => {
    const p = subsolarPoint(new Date(Date.UTC(2026, 2, 20, 12, 0, 0)));
    expect(Math.abs(p.lat)).toBeLessThan(2.5);
    expect(Math.abs(p.lon)).toBeLessThan(1e-9);
  });

  it("places June-solstice declination near positive 23.44 degrees", () => {
    const p = subsolarPoint(new Date(Date.UTC(2026, 5, 21, 12, 0, 0)));
    expect(p.lat).toBeGreaterThan(23);
    expect(p.lat).toBeLessThanOrEqual(23.45);
  });

  it("places December-solstice declination near negative 23.44 degrees", () => {
    const p = subsolarPoint(new Date(Date.UTC(2026, 11, 21, 12, 0, 0)));
    expect(p.lat).toBeLessThan(-23);
    expect(p.lat).toBeGreaterThanOrEqual(-23.45);
  });

  it("places UTC-midnight solar noon near the antimeridian", () => {
    const p = subsolarPoint(new Date(Date.UTC(2026, 2, 20, 0, 0, 0)));
    expect(Math.abs(Math.abs(p.lon) - 180)).toBeLessThan(1e-9);
  });

  it("places the sun near 90 degrees west at 18 UTC", () => {
    const p = subsolarPoint(new Date(Date.UTC(2026, 2, 20, 18, 0, 0)));
    expect(p.lon).toBeCloseTo(-90, 6);
  });

  it("keeps longitude within [-180, 180]", () => {
    for (let h = 0; h < 24; h++) {
      const p = subsolarPoint(new Date(Date.UTC(2026, 6, 4, h, 30, 0)));
      expect(p.lon).toBeGreaterThanOrEqual(-180);
      expect(p.lon).toBeLessThanOrEqual(180);
    }
  });
});

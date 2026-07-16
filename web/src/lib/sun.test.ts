import { describe, expect, it } from "vitest";

import { subsolarPoint } from "./sun";

describe("subsolarPoint", () => {
  it("all'equinozio di marzo a mezzogiorno UTC il sole è ~sopra (0, 0)", () => {
    const p = subsolarPoint(new Date(Date.UTC(2026, 2, 20, 12, 0, 0)));
    expect(Math.abs(p.lat)).toBeLessThan(2.5);
    expect(Math.abs(p.lon)).toBeLessThan(1e-9);
  });

  it("al solstizio di giugno la declinazione è ~+23.44°", () => {
    const p = subsolarPoint(new Date(Date.UTC(2026, 5, 21, 12, 0, 0)));
    expect(p.lat).toBeGreaterThan(23);
    expect(p.lat).toBeLessThanOrEqual(23.45);
  });

  it("al solstizio di dicembre la declinazione è ~-23.44°", () => {
    const p = subsolarPoint(new Date(Date.UTC(2026, 11, 21, 12, 0, 0)));
    expect(p.lat).toBeLessThan(-23);
    expect(p.lat).toBeGreaterThanOrEqual(-23.45);
  });

  it("a mezzanotte UTC il mezzogiorno solare è all'antimeridiano (±180°)", () => {
    const p = subsolarPoint(new Date(Date.UTC(2026, 2, 20, 0, 0, 0)));
    expect(Math.abs(Math.abs(p.lon) - 180)).toBeLessThan(1e-9);
  });

  it("alle 18 UTC il sole è ~90° ovest", () => {
    const p = subsolarPoint(new Date(Date.UTC(2026, 2, 20, 18, 0, 0)));
    expect(p.lon).toBeCloseTo(-90, 6);
  });

  it("la longitudine resta sempre in [-180, 180]", () => {
    for (let h = 0; h < 24; h++) {
      const p = subsolarPoint(new Date(Date.UTC(2026, 6, 4, h, 30, 0)));
      expect(p.lon).toBeGreaterThanOrEqual(-180);
      expect(p.lon).toBeLessThanOrEqual(180);
    }
  });
});

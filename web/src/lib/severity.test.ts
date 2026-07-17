import { describe, expect, it } from "vitest";

import { magnitudeSize, severityColor } from "./severity";

describe("severityColor", () => {
  it("maps low severity to dominant green", () => {
    const [r, g, b] = severityColor(0);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it("maps medium severity to amber", () => {
    const [r, g, b] = severityColor(0.5);
    expect(r).toBeCloseTo(1);
    expect(g).toBeCloseTo(0.69, 1);
    expect(b).toBeCloseTo(0);
  });

  it("maps high severity to dominant red", () => {
    const [r, g, b] = severityColor(1);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
  });

  it("null → trattata come medio (ambra)", () => {
    expect(severityColor(null)).toEqual(severityColor(0.5));
  });

  it("clampa fuori range in [0..1]", () => {
    expect(severityColor(-2)).toEqual(severityColor(0));
    expect(severityColor(5)).toEqual(severityColor(1));
  });

  it("keeps every component within [0..1]", () => {
    for (const s of [0, 0.25, 0.5, 0.75, 1]) {
      for (const c of severityColor(s)) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("magnitudeSize", () => {
  it("increases monotonically with magnitude", () => {
    expect(magnitudeSize(2)).toBeLessThan(magnitudeSize(5));
    expect(magnitudeSize(5)).toBeLessThan(magnitudeSize(7.5));
  });

  it("maps a null magnitude to minimum size", () => {
    expect(magnitudeSize(null)).toBeCloseTo(0.012);
  });

  it("clamps magnitude at eight", () => {
    expect(magnitudeSize(20)).toBeCloseTo(magnitudeSize(8));
  });
});

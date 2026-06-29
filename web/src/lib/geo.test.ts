import { describe, expect, it } from "vitest";

import { degToRad, latLonToVec3 } from "./geo";

const length = ([x, y, z]: number[]): number => Math.sqrt(x * x + y * y + z * z);

describe("degToRad", () => {
  it("converte gradi in radianti", () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI);
    expect(degToRad(0)).toBe(0);
  });
});

describe("latLonToVec3", () => {
  it("mantiene il punto sulla sfera (|v| === radius)", () => {
    expect(length(latLonToVec3(0, 0, 1))).toBeCloseTo(1);
    expect(length(latLonToVec3(45, -120, 3))).toBeCloseTo(3);
    expect(length(latLonToVec3(-33.4, 70.2, 2.5))).toBeCloseTo(2.5);
  });

  it("mappa il polo nord sull'asse +Y", () => {
    const [x, y, z] = latLonToVec3(90, 0, 1);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(1);
    expect(z).toBeCloseTo(0);
  });

  it("mappa il polo sud sull'asse -Y", () => {
    const [, y] = latLonToVec3(-90, 45, 1);
    expect(y).toBeCloseTo(-1);
  });

  it("punti sull'equatore hanno y ≈ 0", () => {
    expect(latLonToVec3(0, 0, 1)[1]).toBeCloseTo(0);
    expect(latLonToVec3(0, 137, 1)[1]).toBeCloseTo(0);
  });

  it("default radius = 1", () => {
    expect(length(latLonToVec3(12, 34))).toBeCloseTo(1);
  });
});

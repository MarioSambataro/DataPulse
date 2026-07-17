// Pure color and size scales shared by shaders, volcano markers, and details.

export type RGB = [number, number, number]; // Components in [0..1] for THREE.Color.

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const mix = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

// Severity gradient stops: green, amber, and red.
const LOW: RGB = [0.18, 0.88, 0.42]; // #2ee06b
const MID: RGB = [1.0, 0.69, 0.0]; // Theme amber.
const HIGH: RGB = [1.0, 0.18, 0.1]; // #ff2e1a

/**
 * Map normalized severity to color. Missing values use a visible midpoint.
 */
export function severityColor(severity: number | null | undefined): RGB {
  const s = clamp01(severity ?? 0.5);
  return s <= 0.5 ? mix(LOW, MID, s / 0.5) : mix(MID, HIGH, (s - 0.5) / 0.5);
}

/** Return the severity gradient as a CSS rgb() string for DOM components. */
export function severityCss(severity: number | null | undefined): string {
  const [r, g, b] = severityColor(severity);
  return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;
}

/**
 * Map earthquake magnitude to a marker size relative to globe radius.
 * Magnitudo tipiche 1..8; clampata a [0..8]. `null` → dimensione minima.
 * A mild quadratic curve emphasizes strong events without hiding weak ones.
 */
export function magnitudeSize(magnitude: number | null | undefined): number {
  const m = Math.min(8, Math.max(0, magnitude ?? 0));
  const t = m / 8;
  return 0.012 + t * t * 0.05; // ~0.012 (micro) .. ~0.062 (mag 8) relativi al raggio
}

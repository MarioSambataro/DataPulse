// Scale pure di colore/dimensione per il rendering degli eventi (SEZIONE 7).
// Nessuna dipendenza da three → testabili in CI senza WebGL. Sono la singola
// fonte di verità della palette eventi: usate sia per i colori per-istanza degli
// epicentri (passati allo shader) sia per i marker vulcano e il pannello dettaglio.

export type RGB = [number, number, number]; // componenti in [0..1] (comode per THREE.Color)

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const mix = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

// Stop del gradiente severità: verde (basso) → ambra (medio) → rosso (alto).
const LOW: RGB = [0.18, 0.88, 0.42]; // #2ee06b
const MID: RGB = [1.0, 0.69, 0.0]; // #ffb000 (ambra del tema)
const HIGH: RGB = [1.0, 0.18, 0.1]; // #ff2e1a

/**
 * Colore di un evento dalla sua `severity` (0..1, già normalizzata dall'ETL).
 * `null`/assente → trattata come 0.5 (medio) così i record senza severità restano visibili.
 */
export function severityColor(severity: number | null | undefined): RGB {
  const s = clamp01(severity ?? 0.5);
  return s <= 0.5 ? mix(LOW, MID, s / 0.5) : mix(MID, HIGH, (s - 0.5) / 0.5);
}

/**
 * Dimensione (in frazione del raggio del globo) di un epicentro a partire dalla magnitudo.
 * Magnitudo tipiche 1..8; clampata a [0..8]. `null` → dimensione minima.
 * Curva leggermente più che lineare per dare risalto ai forti senza saturare i deboli.
 */
export function magnitudeSize(magnitude: number | null | undefined): number {
  const m = Math.min(8, Math.max(0, magnitude ?? 0));
  const t = m / 8;
  return 0.012 + t * t * 0.05; // ~0.012 (micro) .. ~0.062 (mag 8) relativi al raggio
}

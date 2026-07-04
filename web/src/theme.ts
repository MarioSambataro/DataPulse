// Palette "enterprise" di DataPulse: base neutra slate + accento teal. Allineata
// ai design token shadcn in src/index.css (variabili CSS light/dark), così globo
// 3D e UI parlano la stessa lingua cromatica. Le chiavi restano invariate: il
// layer three (Atmosphere/Globe/Scene/SelectionMarker) le legge per riferimento.
export const palette = {
  bg: "#070b12", // slate profondo (sfondo scena)
  panel: "#0c111b",
  acid: "#2dd4bf", // accento primario teal (HUD, atmosfera, griglia, selezione)
  acidDim: "#0f766e", // teal scuro
  signal: "#f59e0b", // ambra segnale (alert, vulcani nell'HUD)
  violet: "#6366f1", // indaco (accento raro)
  amber: "#ffb000", // luci notturne città (resta naturale sul globo)
  atmoInner: "#5d8fd4", // scattering sul lembo del disco (blu satellite)
  atmoOuter: "#88b4ec", // banda di cielo oltre il lembo
  grid: "#7c96b8", // reticolo cartografico neutro (non neon)
  text: "#e2e8f0", // slate-100
  textDim: "#94a3b8", // slate-400
} as const;

export type Palette = typeof palette;

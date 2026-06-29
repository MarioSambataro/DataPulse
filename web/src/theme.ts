// Palette tattica / command-center di DataPulse.
// Accenti ambra + ciano coerenti col portfolio; base scura "spy".
// Usata sia dai componenti React (CSS) sia dal layer three (colori shader).
export const palette = {
  bg: "#05070a", // nero-blu profondo (sfondo scena)
  panel: "#0a0f16",
  grid: "#0e1722",
  amber: "#ffb000", // accento primario (epicentri, glow caldo)
  amberDim: "#7a5500",
  cyan: "#38e1ff", // accento secondario (atmosfera, griglia, HUD)
  cyanDim: "#16606e",
  text: "#c8d6e5",
  textDim: "#5b6b7d",
} as const;

export type Palette = typeof palette;

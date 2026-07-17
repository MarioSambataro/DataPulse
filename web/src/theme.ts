// DataPulse palette aligned with the light/dark CSS design tokens.
export const palette = {
  bg: "#070b12", // Deep slate scene background.
  panel: "#0c111b",
  acid: "#2dd4bf", // Primary teal for HUD, atmosphere, grid, and selection.
  acidDim: "#0f766e", // Dark teal.
  signal: "#f59e0b", // Signal amber for alerts and volcanoes.
  violet: "#6366f1", // Rare indigo accent.
  amber: "#ffb000", // Natural city-light amber.
  atmoInner: "#5d8fd4", // Satellite-blue limb scattering.
  atmoOuter: "#88b4ec", // Outer atmospheric band.
  grid: "#7c96b8", // Neutral cartographic grid.
  text: "#e2e8f0", // Slate 100.
  textDim: "#94a3b8", // Slate 400.
} as const;

export type Palette = typeof palette;

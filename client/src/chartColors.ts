export const PALETTE = [
  "#3bc16b",
  "#5b9cf5",
  "#f5a623",
  "#e5484d",
  "#c084fc",
  "#38bdf8",
  "#fb923c",
  "#a3e635",
  "#f472b6",
  "#22d3ee",
] as const;

export const SCORING_COLORS = {
  eagle: "#c084fc",
  birdie: "#3bc16b",
  par: "#5b9cf5",
  bogey: "#f5a623",
  doublePlus: "#e5484d",
} as const;

export const STROKES_COLORS = {
  underPar: "#3bc16b",
  atPar: "#5b9cf5",
  overOne: "#f5a623",
  overTwo: "#fb923c",
  overThreePlus: "#e5484d",
} as const;

export const TREND_COLORS = {
  points: "#3bc16b",
  strokes: "#5b9cf5",
} as const;

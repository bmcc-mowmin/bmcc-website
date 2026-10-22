export const THEME_COOKIE = "bmcc_theme";

export const THEMES = [
  { id: "current", label: "Current site" },
  { id: "cambridge", label: "A · Light and classical" },
  { id: "zayed", label: "B · Evening and immersive" },
  { id: "irvine", label: "C · Warm and people-first" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

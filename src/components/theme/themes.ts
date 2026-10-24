export const THEME_COOKIE = "bmcc_theme";

// The site's themes. Which one is live is set in src/site-theme.ts; the preview picker
// (THEME_PREVIEW=1) lets you try the other one without changing it.
export const THEMES = [
  { id: "current", label: "Current (default)" },
  { id: "warm", label: "Warm and people-first (backup)" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

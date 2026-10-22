import "server-only";
import { cookies } from "next/headers";
import { THEMES, THEME_COOKIE, type ThemeId } from "@/components/theme/themes";

// Theme preview: lets the committee try the concept themes on the real site before one is chosen.
// Only when THEME_PREVIEW=1; otherwise the site always uses the current look.
export const themePreviewEnabled = () => process.env.THEME_PREVIEW === "1";

export async function getTheme(): Promise<ThemeId> {
  if (!themePreviewEnabled()) return "current";
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return THEMES.some((t) => t.id === value) ? (value as ThemeId) : "current";
}

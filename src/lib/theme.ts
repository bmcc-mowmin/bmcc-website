import "server-only";
import { cookies } from "next/headers";
import { SITE_THEME } from "@/site-theme";
import { THEMES, THEME_COOKIE, type ThemeId } from "@/components/theme/themes";

// The live theme comes from src/site-theme.ts. With THEME_PREVIEW=1 a visitor can try the other
// theme through the preview picker (remembered in a cookie); production leaves it off.
export const themePreviewEnabled = () => process.env.THEME_PREVIEW === "1";

export async function getTheme(): Promise<ThemeId> {
  if (!themePreviewEnabled()) return SITE_THEME;
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return THEMES.some((t) => t.id === value) ? (value as ThemeId) : SITE_THEME;
}

"use client";

import { useRouter } from "next/navigation";
import { THEMES, THEME_COOKIE, type ThemeId } from "./themes";
import styles from "./theme.module.css";

// Floating picker for trying the concept themes on the real site (THEME_PREVIEW=1 only).
// English-only on purpose: it's a tool for the committee, not part of the site.
export function ThemePicker({ theme }: { theme: ThemeId }) {
  const router = useRouter();
  return (
    <div className={styles.picker} dir="auto">
      <label htmlFor="theme-picker">Theme preview</label>
      <select
        id="theme-picker"
        value={theme}
        onChange={(e) => {
          document.cookie = `${THEME_COOKIE}=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
          router.refresh();
        }}
      >
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}

"use client";

import { createContext, useContext, useEffect } from "react";
import { LANG_STORAGE_KEY, isLang, type Lang } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionary";

type I18n = { lang: Lang; t: Dictionary; dir: "ltr" | "rtl" };
const I18nContext = createContext<I18n | null>(null);

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

const ONE_YEAR = 60 * 60 * 24 * 365;

export function setLangPreference(code: Lang) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, code);
  } catch {}
  document.cookie = `${LANG_STORAGE_KEY}=${code}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

export function I18nProvider({ value, children }: { value: I18n; children: React.ReactNode }) {
  useEffect(() => {
    // Keep every open tab on the same language (the prototype listened for `storage` too).
    const onStorage = (e: StorageEvent) => {
      if (e.key === LANG_STORAGE_KEY && isLang(e.newValue) && e.newValue !== value.lang) {
        window.location.reload();
      }
    };
    window.addEventListener("storage", onStorage);

    // A visitor with a saved language but no cookie (cleared cookies): restore it.
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      const hasCookie = document.cookie.split("; ").some((c) => c.startsWith(`${LANG_STORAGE_KEY}=`));
      if (!hasCookie && isLang(saved) && saved !== value.lang) {
        setLangPreference(saved);
        window.location.reload();
      }
    } catch {}

    return () => window.removeEventListener("storage", onStorage);
  }, [value.lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

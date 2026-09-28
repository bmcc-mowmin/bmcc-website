import en from "../../../messages/en.json";
import dari from "../../../messages/dari.json";
import urdu from "../../../messages/urdu.json";
import pashto from "../../../messages/pashto.json";
import { DEFAULT_LANG, type Lang } from "./config";

export type MessageKey = keyof typeof en;
export type Dictionary = Record<MessageKey, string>;

const partials: Record<Lang, Partial<Dictionary>> = { en, dari, urdu, pashto };

// Same behavior as the prototype's t(lang): the chosen language merged over English,
// so any key without a translation falls back to English.
const cache = new Map<Lang, Dictionary>();
export function getDictionary(lang: Lang): Dictionary {
  let dict = cache.get(lang);
  if (!dict) {
    dict = { ...en, ...partials[lang] } as Dictionary;
    cache.set(lang, dict);
  }
  return dict;
}

// Per-language text stored in the database: { en: "...", dari: "...", ... }.
export type L10n = Partial<Record<Lang, string>>;

export function localize(value: unknown, lang: Lang): string {
  if (!value || typeof value !== "object") return typeof value === "string" ? value : "";
  const v = value as L10n;
  return v[lang]?.trim() || v[DEFAULT_LANG] || "";
}

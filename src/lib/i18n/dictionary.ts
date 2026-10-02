import en from "../../../messages/en.json";
import dari from "../../../messages/dari.json";
import urdu from "../../../messages/urdu.json";
import pashto from "../../../messages/pashto.json";
import spanish from "../../../messages/spanish.json";
import { DEFAULT_LANG, type Lang } from "./config";

export type MessageKey = keyof typeof en;
export type Dictionary = Record<MessageKey, string>;

const partials: Record<Lang, Partial<Dictionary>> = { en, dari, urdu, pashto, spanish };

// Admin edits (Admin → Site text) layered over the files. Set on the server by
// src/lib/i18n/overrides.ts; the browser gets the finished dictionary from the server.
type Overrides = Partial<Record<Lang, Partial<Dictionary>>>;
let overrides: Overrides = {};
export function setMessageOverrides(next: Overrides) {
  overrides = next;
  cache.clear();
}

// Same behavior as the prototype's t(lang): the chosen language merged over English,
// so any key without a translation falls back to English.
const cache = new Map<Lang, Dictionary>();
export function getDictionary(lang: Lang): Dictionary {
  let dict = cache.get(lang);
  if (!dict) {
    dict = { ...en, ...overrides.en, ...partials[lang], ...overrides[lang] } as Dictionary;
    cache.set(lang, dict);
  }
  return dict;
}

// The built-in text from the files (no admin edits), for the Site text editor.
export function builtInText(lang: Lang): Partial<Dictionary> {
  return partials[lang];
}

// Per-language text stored in the database: { en: "...", dari: "...", ... }.
export type L10n = Partial<Record<Lang, string>>;

export function localize(value: unknown, lang: Lang): string {
  if (!value || typeof value !== "object") return typeof value === "string" ? value : "";
  const v = value as L10n;
  return v[lang]?.trim() || v[DEFAULT_LANG] || "";
}

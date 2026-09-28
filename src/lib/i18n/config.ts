// Language codes match the design handoff (i18n.js), plus Spanish (added after the handoff).
// Arabic is deferred to a later phase:
// add it here, add messages/arabic.json, and it appears in the language menu.

export const LANGS = [
  { code: "en", label: "English (US)", intl: "en-US", html: "en" },
  { code: "dari", label: "Dari", intl: "fa-AF", html: "fa-AF" },
  { code: "urdu", label: "Urdu", intl: "ur-PK", html: "ur-PK" },
  { code: "pashto", label: "Pashtu", intl: "ps-AF", html: "ps-AF" },
  { code: "spanish", label: "Spanish", intl: "es-US", html: "es-US" },
] as const;

export type Lang = (typeof LANGS)[number]["code"];

export const DEFAULT_LANG: Lang = "en";
export const RTL_LANGS: readonly Lang[] = ["dari", "urdu", "pashto"];

// Same key the prototype used in localStorage; also used as the cookie name so the
// server can render the right language and `dir` on the first request.
export const LANG_STORAGE_KEY = "bmcc_lang";

export function isLang(v: unknown): v is Lang {
  return typeof v === "string" && LANGS.some((l) => l.code === v);
}

export function isRTL(lang: Lang) {
  return RTL_LANGS.includes(lang);
}

export function intlLocale(lang: Lang) {
  return LANGS.find((l) => l.code === lang)?.intl ?? "en-US";
}

export function htmlLang(lang: Lang) {
  return LANGS.find((l) => l.code === lang)?.html ?? "en";
}

import "server-only";
import { LANGS } from "@/lib/i18n/config";
import type { L10n } from "@/lib/i18n/dictionary";

// Helpers for reading admin forms.

export function readL10n(form: FormData, name: string): L10n {
  const out: L10n = {};
  for (const { code } of LANGS) {
    const v = String(form.get(`${name}.${code}`) ?? "").trim();
    if (v) out[code] = v.slice(0, 1000);
  }
  return out;
}

export const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
export const optionalText = (form: FormData, name: string) => text(form, name) || null;

export function fail(message: string) {
  return { ok: false, message };
}
export function done(message: string) {
  return { ok: true, message };
}

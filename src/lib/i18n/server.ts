import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LANG, LANG_STORAGE_KEY, isLang, isRTL, type Lang } from "./config";
import { getDictionary } from "./dictionary";
import { ensureMessageOverrides } from "./overrides";

export async function getLang(): Promise<Lang> {
  await ensureMessageOverrides();
  const value = (await cookies()).get(LANG_STORAGE_KEY)?.value;
  return isLang(value) ? value : DEFAULT_LANG;
}

// For server components: const { t, lang, dir } = await getI18n();
export async function getI18n() {
  const lang = await getLang();
  return { lang, t: getDictionary(lang), dir: isRTL(lang) ? ("rtl" as const) : ("ltr" as const) };
}

import { intlLocale, type Lang } from "@/lib/i18n/config";
import type { Dictionary, MessageKey } from "@/lib/i18n/dictionary";
import { FUNDS } from "@/lib/payments/catalog";

// Dates in the visitor's language, on the masjid's calendar day.
export const formatDate = (d: Date, lang: Lang, timeZone: string) => new Intl.DateTimeFormat(intlLocale(lang), { dateStyle: "long", timeZone }).format(d);

export function paymentLabel(p: { kind: string; fund: string | null }, t: Dictionary) {
  if (p.kind === "DUES") return t.acct_dues_label;
  const fund = FUNDS.find((f) => f.id === p.fund);
  return fund ? t[fund.nameKey as MessageKey] : t.nav_donate;
}

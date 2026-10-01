import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { localize } from "@/lib/i18n/dictionary";
import type { Lang } from "@/lib/i18n/config";
import { addDays, weekdayOf } from "@/lib/time";
import { masjidNow, type DaySchedule, type JumuahService } from "./next-prayer";
import { isClock, resolveDay, type CalcSettings, type DayOverrideInput, type IqamahRuleInput } from "./calculate";
import { externalSource } from "./sources";

// THE single source of truth for prayer times. The header's Next Prayer, the Home table,
// the Prayer Times page, the API and the monthly PDF all come from here:
//   calculated Adhan (Hanafi Asr) → admin day override → Iqamah rule.

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export const getCalcSettings = cache(async (): Promise<CalcSettings & { source: string }> => {
  const s = await db.prayerSettings.findUnique({ where: { id: 1 } });
  return {
    source: s?.source ?? "builtin",
    latitude: s?.latitude ?? env.MASJID_LAT,
    longitude: s?.longitude ?? env.MASJID_LNG,
    timezone: s?.timezone ?? env.MASJID_TIMEZONE,
    calcMethod: s?.calcMethod ?? "NorthAmerica",
    highLatRule: s?.highLatRule ?? "MiddleOfTheNight",
  };
});

const getIqamahRules = cache(async (): Promise<IqamahRuleInput[]> => {
  const rows = await db.iqamahRule.findMany();
  return rows.map((r) => ({
    prayer: r.prayer.toLowerCase() as IqamahRuleInput["prayer"],
    mode: r.mode,
    offsetMinutes: r.offsetMinutes,
    fixedTime: r.fixedTime,
    effectiveFrom: isoDate(r.effectiveFrom),
    effectiveTo: r.effectiveTo ? isoDate(r.effectiveTo) : null,
  }));
});

const getJumuahRows = cache(() => db.jumuahService.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }));

async function getOverrides(from: string, to: string) {
  const rows = await db.prayerDayOverride.findMany({
    where: { date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) } },
  });
  return new Map(rows.map((r) => [isoDate(r.date), r]));
}

type OverrideRow = NonNullable<Awaited<ReturnType<typeof db.prayerDayOverride.findUnique>>>;

// An override may replace that Friday's Jumu'ah list: [{label, khutbah, iqamah, location}].
function overrideJumuah(row: OverrideRow | undefined): JumuahService[] | null {
  const list = row?.jumuah;
  if (!Array.isArray(list) || list.length === 0) return null; // null / DbNull = use the regular services
  return list
    .filter((j): j is Record<string, string> => !!j && typeof j === "object" && !Array.isArray(j))
    .filter((j) => isClock(j.khutbah) && isClock(j.iqamah))
    .map((j) => ({ label: String(j.label ?? "Jumu'ah"), khutbah: j.khutbah, iqamah: j.iqamah, location: String(j.location ?? "") }));
}

export type ResolvedDay = DaySchedule & { overridden: string[]; note: string | null };

async function buildDay(date: string, lang: Lang, override: OverrideRow | undefined): Promise<ResolvedDay> {
  const [settings, rules, jumuahRows] = await Promise.all([getCalcSettings(), getIqamahRules(), getJumuahRows()]);
  const weekday = weekdayOf(date);
  let { prayers, overridden } = resolveDay(date, settings, rules, (override ?? null) as DayOverrideInput | null);
  // An external provider, when one is connected and selected, supplies the daily times instead.
  // If it fails, the calculated times above are kept so the site never goes blank.
  const external = settings.source !== "builtin" ? externalSource(settings.source) : null;
  if (external) {
    try {
      ({ prayers } = await external.getDay(date));
      overridden = [];
    } catch (e) {
      console.error(`prayer source "${external.id}" failed; using built-in times`, e);
    }
  }
  let jumuah: JumuahService[] = [];
  if (weekday === 5) {
    const custom = overrideJumuah(override);
    if (custom) overridden.push("jumuah");
    jumuah =
      custom ??
      jumuahRows.map((r) => ({
        label: localize(r.label, lang),
        khutbah: r.khutbahTime,
        iqamah: r.iqamahTime,
        location: localize(r.location, lang),
        note: localize(r.note, lang) || undefined,
      }));
  }
  return { date, weekday, prayers, jumuah, overridden, note: override?.note ?? null };
}

export async function getDaySchedule(date: string, lang: Lang = "en") {
  const overrides = await getOverrides(date, date);
  return buildDay(date, lang, overrides.get(date));
}

// Every day of a month ("YYYY-MM") — the monthly PDF and the admin month view.
export async function getMonthSchedule(month: string, lang: Lang = "en") {
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = `${month}-${String(days).padStart(2, "0")}`;
  const overrides = await getOverrides(first, last);
  const dates = Array.from({ length: days }, (_, i) => addDays(first, i));
  return Promise.all(dates.map((d) => buildDay(d, lang, overrides.get(d))));
}

// The masjid's current date and minute (its time zone, never the visitor's or the server's).
export async function masjidClock(now: Date = new Date()) {
  const { timezone } = await getCalcSettings();
  return { ...masjidNow(timezone, now), timeZone: timezone };
}

// This week's Jumu'ah services (today if it is Friday, otherwise the coming Friday).
// Shown on the Home table and the Prayer Times page every day of the week.
export async function getUpcomingJumuah(lang: Lang = "en", now: Date = new Date()) {
  const { date, weekday } = await masjidClock(now);
  const friday = addDays(date, (5 - weekday + 7) % 7);
  return (await getDaySchedule(friday, lang)).jumuah;
}

// Today and tomorrow at the masjid — what the header's Next Prayer needs.
export async function getTodayAndTomorrow(lang: Lang = "en", now: Date = new Date()) {
  const { date, timeZone } = await masjidClock(now);
  const [today, tomorrow] = await Promise.all([getDaySchedule(date, lang), getDaySchedule(addDays(date, 1), lang)]);
  return { today, tomorrow, timeZone };
}

// A day exactly as calculated, ignoring any override (admin shows it next to the override inputs).
export async function getCalculatedDay(date: string) {
  return buildDay(date, "en", undefined);
}

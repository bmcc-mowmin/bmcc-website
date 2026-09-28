import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { localize } from "@/lib/i18n/dictionary";
import type { Lang } from "@/lib/i18n/config";
import { addDays, weekdayOf } from "@/lib/time";
import { masjidNow, type DaySchedule, type JumuahService } from "./next-prayer";

// THE single source of truth for prayer times. Header, Home table and Prayer Times page
// all call getDaySchedule().
//
// PHASE 1: the five daily times are the prototype's example schedule; Jumu'ah comes from
// the JumuahService table. PHASE 2 replaces the daily times with adhan-js (Hanafi Asr)
// + IqamahRule + PrayerDayOverride. The function signature stays the same.

async function getJumuahServices(lang: Lang): Promise<JumuahService[]> {
  const rows = await db.jumuahService.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({
    label: localize(r.label, lang),
    khutbah: r.khutbahTime,
    iqamah: r.iqamahTime,
    location: localize(r.location, lang),
    note: localize(r.note, lang) || undefined,
  }));
}

export async function getDaySchedule(date: string, lang: Lang = "en"): Promise<DaySchedule> {
  const weekday = weekdayOf(date);
  return {
    date,
    weekday,
    prayers: [
      { key: "fajr", adhan: "05:12", iqamah: "05:30" },
      { key: "dhuhr", adhan: "12:45", iqamah: "13:15" },
      { key: "asr", adhan: "17:45", iqamah: "18:00" },
      { key: "maghrib", adhan: "19:58", iqamah: "20:03" },
      { key: "isha", adhan: "21:20", iqamah: "21:35" },
    ],
    jumuah: weekday === 5 ? await getJumuahServices(lang) : [],
  };
}

// This week's Jumu'ah services (today if it is Friday, otherwise the coming Friday).
// Shown on the Home table and the Prayer Times page every day of the week.
export async function getUpcomingJumuah(lang: Lang = "en", now: Date = new Date()) {
  const { date, weekday } = masjidNow(env.MASJID_TIMEZONE, now);
  const friday = addDays(date, (5 - weekday + 7) % 7);
  return (await getDaySchedule(friday, lang)).jumuah;
}

// Today and tomorrow at the masjid — what the header's Next Prayer needs.
export async function getTodayAndTomorrow(lang: Lang = "en", now: Date = new Date()) {
  const { date } = masjidNow(env.MASJID_TIMEZONE, now);
  const [today, tomorrow] = await Promise.all([getDaySchedule(date, lang), getDaySchedule(addDays(date, 1), lang)]);
  return { today, tomorrow, timeZone: env.MASJID_TIMEZONE };
}

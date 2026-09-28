// Pure helpers shared by the server and the browser (the header recomputes every 30s).
// All clock times are "HH:mm" in the MASJID's time zone, never the visitor's.

export type PrayerKey = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha" | "jumuah";

export type PrayerTime = { key: PrayerKey; adhan: string; iqamah: string };

export type JumuahService = { label: string; khutbah: string; iqamah: string; location: string; note?: string };

export type DaySchedule = {
  date: string; // YYYY-MM-DD, masjid-local
  weekday: number; // 0 = Sunday … 5 = Friday
  prayers: PrayerTime[]; // the five daily prayers, in order
  jumuah: JumuahService[]; // only on Fridays
};

export type NextPrayer = { key: PrayerKey; time: string; tomorrow: boolean };

export function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// The current weekday, date and minute-of-day at the masjid.
export function masjidNow(timeZone: string, now: Date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const days: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: days[parts.weekday],
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
  };
}

// The prayers people actually attend that day: on Fridays the first Jumu'ah replaces Dhuhr.
export function prayersForDay(day: DaySchedule): { key: PrayerKey; adhan: string }[] {
  return day.prayers.map((p) =>
    day.weekday === 5 && p.key === "dhuhr" && day.jumuah[0]
      ? { key: "jumuah" as const, adhan: day.jumuah[0].khutbah }
      : { key: p.key, adhan: p.adhan },
  );
}

// Next Adhan after "now" at the masjid; after Isha it is tomorrow's Fajr.
export function nextPrayer(today: DaySchedule, tomorrow: DaySchedule, minutesNow: number): NextPrayer {
  const upcoming = prayersForDay(today).find((p) => toMinutes(p.adhan) > minutesNow);
  if (upcoming) return { key: upcoming.key, time: upcoming.adhan, tomorrow: false };
  const first = prayersForDay(tomorrow)[0];
  return { key: first.key, time: first.adhan, tomorrow: true };
}

// Formats "HH:mm" in the visitor's language (non-English locales show their own digits).
// Uses a fixed UTC date so server and browser render identical text.
export function formatClock(hhmm: string, intlLocale: string) {
  const [h, m] = hhmm.split(":").map(Number);
  try {
    return new Intl.DateTimeFormat(intlLocale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(
      new Date(Date.UTC(2000, 0, 1, h, m)),
    );
  } catch {
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  }
}

// "Sunday, September 27" in the visitor's language, for a masjid-local date.
export function formatDayLabel(date: string, intlLocale: string) {
  return new Intl.DateTimeFormat(intlLocale, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

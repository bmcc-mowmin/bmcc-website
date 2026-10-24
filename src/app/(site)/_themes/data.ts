import "server-only";
import { getI18n } from "@/lib/i18n/server";
import { intlLocale } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/dictionary";
import { getTodayAndTomorrow, getUpcomingJumuah, masjidClock } from "@/lib/prayer/schedule";
import { formatClock, formatDayLabel, masjidNow, nextPrayer } from "@/lib/prayer/next-prayer";
import { getUpcomingEvents, formatEventWhen } from "@/lib/events";
import { collectionPhotos, slotImage } from "@/lib/media";

// Everything the backup theme's Home layout shows, from the same sources as the current Home page.
// Land photos are never used here: they belong only on the New BMCC project page.

export async function getThemedHomeData() {
  const { t, lang } = await getI18n();
  const locale = intlLocale(lang);
  const [{ today, tomorrow }, jumuah, events, { timeZone }, homePhoto, general] = await Promise.all([
    getTodayAndTomorrow(lang),
    getUpcomingJumuah(lang),
    getUpcomingEvents(lang, { limit: 12 }),
    masjidClock(),
    slotImage("home_photo", lang),
    collectionPhotos("general", lang),
  ]);

  const now = masjidNow(timeZone);
  const next = now.date === tomorrow.date ? nextPrayer(tomorrow, tomorrow, now.minutes) : nextPrayer(today, tomorrow, now.minutes);
  // On Fridays the next "prayer" may be Jumu'ah, which takes Dhuhr's row.
  const nextKey = next.tomorrow ? null : next.key === "jumuah" ? "dhuhr" : next.key;
  const prayers = today.prayers.map((p) => ({
    key: p.key,
    name: t[`prayer_${p.key}` as MessageKey],
    adhan: formatClock(p.adhan, locale),
    iqamah: formatClock(p.iqamah, locale),
    isNext: p.key === nextKey,
  }));

  const list = new Intl.ListFormat(locale, { type: "conjunction" });
  const jumuahTimes = list.format(jumuah.map((j) => formatClock(j.khutbah, locale)));

  const hijriLocale = `${locale.replace(/-u-.*$/, "")}-u-ca-islamic-umalqura`;
  let hijri = "";
  try {
    hijri = new Intl.DateTimeFormat(hijriLocale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${today.date}T12:00:00Z`));
  } catch {
    hijri = "";
  }

  const shaped = events.map((e) => {
    const when = formatEventWhen(e, e.next, lang, t, timeZone);
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone }).formatToParts(e.next.start).map((p) => [p.type, p.value]),
    );
    return {
      slug: e.slug,
      title: e.title,
      description: e.description,
      imageUrl: e.imageUrl,
      weekly: e.recurringWeekday !== null,
      weekday: new Intl.DateTimeFormat(locale, { weekday: "short", timeZone }).format(e.next.start),
      month: parts.month ?? "",
      day: parts.day ?? "",
      date: when.date,
      time: when.startTime,
    };
  });

  // Photos for the layouts: the chosen Home photo first, then the other general photos.
  const photos = [homePhoto, ...general.filter((p) => p.url !== homePhoto?.url)].filter((p): p is NonNullable<typeof p> => !!p);

  return {
    t,
    lang,
    locale,
    dateLabel: formatDayLabel(today.date, locale),
    hijri,
    prayers,
    jumuahTimes,
    hasJumuah: jumuah.length > 0,
    photos,
    oneOff: shaped.filter((e) => !e.weekly),
    weekly: shaped.filter((e) => e.weekly),
  };
}

export type ThemedHomeData = Awaited<ReturnType<typeof getThemedHomeData>>;

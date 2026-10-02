import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { localize, type Dictionary } from "@/lib/i18n/dictionary";
import { intlLocale, ltrIsolate, type Lang } from "@/lib/i18n/config";
import { getOrg, type Org } from "@/lib/org";
import { getCalcSettings } from "@/lib/prayer/schedule";
import { upcomingOccurrences, weeklyDay, type Occurrence } from "./recurrence";
import { googleCalendarUrl, type CalendarEvent } from "./calendar";

export type PublicEvent = {
  id: string;
  slug: string;
  title: string;
  description: string;
  tag: string;
  location: string;
  imageUrl: string | null;
  allDay: boolean;
  recurringWeekday: number | null; // 0–6 when it repeats weekly
  next: Occurrence;
  upcoming: Occurrence[];
  icsUrl: string;
  googleUrl: string;
};

type EventRow = Awaited<ReturnType<typeof db.event.findMany>>[number];

export const mediaUrl = (key: string | null) => (key ? `/media/${key}` : null);

function calendarData(row: EventRow, lang: Lang, org: Org): CalendarEvent {
  return {
    uid: `${row.id}@${new URL(env.APP_URL).hostname}`,
    title: localize(row.title, lang),
    description: localize(row.description, lang),
    location: `${localize(row.location, lang)}, ${org.legalName}, ${org.address}`,
    url: `${env.APP_URL}/events/${row.slug}`,
    startAt: row.startAt,
    endAt: row.endAt,
    allDay: row.allDay,
    rrule: row.rrule,
    rruleUntil: row.rruleUntil,
  };
}

function toPublic(row: EventRow, lang: Lang, upcoming: Occurrence[], timeZone: string, org: Org): PublicEvent {
  return {
    id: row.id,
    slug: row.slug,
    title: localize(row.title, lang),
    description: localize(row.description, lang),
    tag: localize(row.tag, lang),
    location: localize(row.location, lang),
    imageUrl: mediaUrl(row.imageKey),
    allDay: row.allDay,
    recurringWeekday: weeklyDay(row.rrule),
    next: upcoming[0],
    upcoming,
    icsUrl: `/api/events/${row.slug}/ics?lang=${lang}`,
    googleUrl: googleCalendarUrl(calendarData(row, lang, org), timeZone),
  };
}

// Published events that haven't finished, soonest first (each event once, at its next date).
export async function getUpcomingEvents(lang: Lang, { limit, now = new Date() }: { limit?: number; now?: Date } = {}) {
  const { timezone } = await getCalcSettings();
  const [rows, org] = await Promise.all([db.event.findMany({ where: { published: true } }), getOrg()]);
  const events = rows
    .map((row) => toPublic(row, lang, upcomingOccurrences(row, timezone, now, 1), timezone, org))
    .filter((e) => e.next)
    .sort((a, b) => a.next.start.getTime() - b.next.start.getTime());
  return limit ? events.slice(0, limit) : events;
}

export async function getEventBySlug(slug: string, lang: Lang, now = new Date()) {
  const row = await db.event.findUnique({ where: { slug } });
  if (!row || !row.published) return null;
  const { timezone } = await getCalcSettings();
  const upcoming = upcomingOccurrences(row, timezone, now, 6);
  // A past one-off event still has a page; show its original date.
  return toPublic(row, lang, upcoming.length ? upcoming : [{ start: row.startAt, end: row.endAt }], timezone, await getOrg());
}

// Data for the .ics file (in the visitor's language).
export async function getCalendarEvent(slug: string, lang: Lang): Promise<(CalendarEvent & { timeZone: string }) | null> {
  const row = await db.event.findUnique({ where: { slug } });
  if (!row || !row.published) return null;
  const { timezone } = await getCalcSettings();
  return { ...calendarData(row, lang, await getOrg()), timeZone: timezone };
}

// "Every Friday" / "Sat, Oct 10" and "1:00 PM – 2:00 PM" in the visitor's language.
export function formatEventWhen(e: PublicEvent, occ: Occurrence, lang: Lang, t: Dictionary, timeZone: string) {
  const locale = intlLocale(lang);
  const date =
    e.recurringWeekday !== null
      ? t.every_weekday.replace("{day}", new Intl.DateTimeFormat(locale, { weekday: "long", timeZone }).format(occ.start))
      : new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", timeZone }).format(occ.start);
  const fullDate = new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone }).format(occ.start);
  const clock = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone });
  const startTime = e.allDay ? "" : ltrIsolate(clock.format(occ.start), locale);
  const timeRange = e.allDay ? "" : ltrIsolate(`${clock.format(occ.start)} – ${clock.format(occ.end)}`, locale);
  return { date, fullDate, startTime, timeRange };
}

// Event dates without a database, so they can be unit tested.
//
// Recurrence is evaluated on the masjid's WALL-CLOCK time (e.g. "every Friday 1:00 PM"), then each
// occurrence is converted to a real instant in the masjid's time zone. That keeps weekly events at
// 1:00 PM local across daylight-saving changes.
import { rrulestr } from "rrule";
import { zonedToUtc } from "@/lib/time";

export type EventTiming = {
  startAt: Date; // first occurrence (instant)
  endAt: Date;
  allDay: boolean;
  rrule: string | null; // e.g. "FREQ=WEEKLY;BYDAY=FR"
  rruleUntil: Date | null;
};

export type Occurrence = { start: Date; end: Date };

// Instant → masjid wall-clock parts.
export function wallClock(instant: Date, timeZone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(instant)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${String(Number(p.hour) % 24).padStart(2, "0")}:${p.minute}` };
}

// A wall-clock time encoded as a UTC Date ("floating" time) — what rrule calculates with.
function floating(instant: Date, timeZone: string) {
  const { date, time } = wallClock(instant, timeZone);
  return new Date(`${date}T${time}:00Z`);
}
function fromFloating(f: Date, timeZone: string) {
  const iso = f.toISOString();
  return zonedToUtc(iso.slice(0, 10), iso.slice(11, 16), timeZone);
}

// Occurrences that are still running or start after `from`, up to `limit`.
export function upcomingOccurrences(e: EventTiming, timeZone: string, from: Date, limit = 1): Occurrence[] {
  const duration = e.endAt.getTime() - e.startAt.getTime();
  if (!e.rrule) return e.endAt > from ? [{ start: e.startAt, end: e.endAt }] : [];

  const rule = rrulestr(e.rrule, { dtstart: floating(e.startAt, timeZone) });
  const until = e.rruleUntil ? floating(e.rruleUntil, timeZone) : null;
  // Start looking back by the event's duration so an occurrence in progress still counts.
  const windowStart = floating(new Date(from.getTime() - duration), timeZone);
  const windowEnd = new Date(windowStart.getTime() + 400 * 86400000);
  const out: Occurrence[] = [];
  rule.between(windowStart, windowEnd, true, (date) => {
    if (until && date > until) return false;
    const start = fromFloating(date, timeZone);
    const end = new Date(start.getTime() + duration);
    if (end > from) out.push({ start, end });
    return out.length < limit;
  });
  return out;
}

export const WEEKDAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

// "FREQ=WEEKLY;BYDAY=FR" → 5 (Friday). Only simple weekly rules are created by admin.
export function weeklyDay(rrule: string | null): number | null {
  const m = rrule?.match(/FREQ=WEEKLY;BYDAY=([A-Z]{2})$/);
  return m ? WEEKDAY_CODES.indexOf(m[1] as (typeof WEEKDAY_CODES)[number]) : null;
}

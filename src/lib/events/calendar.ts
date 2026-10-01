// "+ iCal" (.ics file) and "+ Google" (Calendar template link) for an event.
// Times are written in the masjid's time zone with a VTIMEZONE block, so a weekly event stays at
// the same local time after daylight-saving changes in every calendar app.
import { zonedToUtc } from "@/lib/time";
import { wallClock, type EventTiming } from "./recurrence";

export type CalendarEvent = EventTiming & {
  uid: string;
  title: string;
  description: string;
  location: string;
  url: string;
};

const compact = (date: string, time: string) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function nextDay(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

// RFC 5545 text escaping and 75-octet line folding.
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function fold(line: string) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + (start === 0 ? 75 : 74), bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--; // don't split a UTF-8 character
    parts.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
  }
  return parts.join("\r\n ");
}

// US Pacific rules (since 2007). Only America/Los_Angeles is supported, which is the masjid's zone.
const VTIMEZONE_LA = [
  "BEGIN:VTIMEZONE",
  "TZID:America/Los_Angeles",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0800",
  "TZOFFSETTO:-0700",
  "TZNAME:PDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0700",
  "TZOFFSETTO:-0800",
  "TZNAME:PST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

// RFC 5545: with a zoned DTSTART, UNTIL must be in UTC; with an all-day DTSTART, it is a DATE.
// The repeat runs through the end of the "until" day at the masjid.
function recurrence(e: CalendarEvent, timeZone: string) {
  if (!e.rrule) return null;
  if (!e.rruleUntil) return e.rrule;
  const untilDate = wallClock(e.rruleUntil, timeZone).date;
  const until = e.allDay ? untilDate.replace(/-/g, "") : utcStamp(zonedToUtc(untilDate, "23:59", timeZone));
  return `${e.rrule};UNTIL=${until}`;
}

export function buildIcs(e: CalendarEvent, timeZone: string, now = new Date()) {
  const start = wallClock(e.startAt, timeZone);
  const end = wallClock(e.endAt, timeZone);
  const rrule = recurrence(e, timeZone);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Brentwood Muslim Community Center//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...(e.allDay ? [] : VTIMEZONE_LA),
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    ...(e.allDay
      ? [`DTSTART;VALUE=DATE:${start.date.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${nextDay(end.date)}`]
      : [`DTSTART;TZID=${timeZone}:${compact(start.date, start.time)}`, `DTEND;TZID=${timeZone}:${compact(end.date, end.time)}`]),
    ...(rrule ? [`RRULE:${rrule}`] : []),
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(`${e.description}\n\n${e.url}`)}`,
    `LOCATION:${esc(e.location)}`,
    `URL:${e.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(e: CalendarEvent, timeZone: string) {
  const start = wallClock(e.startAt, timeZone);
  const end = wallClock(e.endAt, timeZone);
  const dates = e.allDay
    ? `${start.date.replace(/-/g, "")}/${nextDay(end.date)}`
    : `${compact(start.date, start.time)}/${compact(end.date, end.time)}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates,
    details: `${e.description}\n\n${e.url}`,
    location: e.location,
    ctz: timeZone,
  });
  const rrule = recurrence(e, timeZone);
  if (rrule) params.set("recur", `RRULE:${rrule}`);
  return `https://calendar.google.com/calendar/render?${params}`;
}

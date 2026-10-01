// Unit tests for event dates and calendar exports. Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { upcomingOccurrences, wallClock, weeklyDay } from "../../src/lib/events/recurrence";
import { buildIcs, googleCalendarUrl, type CalendarEvent } from "../../src/lib/events/calendar";
import { zonedToUtc } from "../../src/lib/time";

const TZ = "America/Los_Angeles";
const at = (d: string, t: string) => zonedToUtc(d, t, TZ);

const jumuah = { startAt: at("2026-10-02", "13:00"), endAt: at("2026-10-02", "14:00"), allDay: false, rrule: "FREQ=WEEKLY;BYDAY=FR", rruleUntil: null };

test("weekly events stay at 1:00 PM local across the DST change", () => {
  const occ = upcomingOccurrences(jumuah, TZ, at("2026-10-26", "00:00"), 3);
  assert.deepEqual(
    occ.map((o) => wallClock(o.start, TZ)),
    [
      { date: "2026-10-30", time: "13:00" },
      { date: "2026-11-06", time: "13:00" }, // after DST ends on Nov 1
      { date: "2026-11-13", time: "13:00" },
    ],
  );
  // Same wall time, different UTC offset (PDT → PST).
  assert.equal(occ[0].start.toISOString(), "2026-10-30T20:00:00.000Z");
  assert.equal(occ[1].start.toISOString(), "2026-11-06T21:00:00.000Z");
});

test("an occurrence in progress still counts as upcoming", () => {
  const [o] = upcomingOccurrences(jumuah, TZ, at("2026-10-09", "13:30"), 1);
  assert.equal(wallClock(o.start, TZ).date, "2026-10-09");
  const [later] = upcomingOccurrences(jumuah, TZ, at("2026-10-09", "14:01"), 1);
  assert.equal(wallClock(later.start, TZ).date, "2026-10-16");
});

test("weekly events stop after their 'until' date; one-offs disappear once over", () => {
  const limited = { ...jumuah, rruleUntil: at("2026-10-16", "23:59") };
  assert.equal(upcomingOccurrences(limited, TZ, at("2026-10-08", "00:00"), 5).length, 2); // Oct 9 and Oct 16 (the last)
  const oneOff = { ...jumuah, rrule: null };
  assert.equal(upcomingOccurrences(oneOff, TZ, at("2026-10-01", "00:00")).length, 1);
  assert.equal(upcomingOccurrences(oneOff, TZ, at("2026-10-02", "14:00")).length, 0);
});

test("weeklyDay reads the weekday from a simple weekly rule", () => {
  assert.equal(weeklyDay("FREQ=WEEKLY;BYDAY=FR"), 5);
  assert.equal(weeklyDay("FREQ=WEEKLY;BYDAY=SA"), 6);
  assert.equal(weeklyDay(null), null);
});

const calEvent: CalendarEvent = {
  ...jumuah,
  rruleUntil: at("2026-12-31", "23:59"),
  uid: "abc@bmcc.test",
  title: "Jumu'ah, weekly; khutbah",
  description: "Line one\nLine two",
  location: "Main Hall, 7701 Lone Tree Way, Brentwood, CA 94513",
  url: "https://bmcc.test/events/friday-jumuah",
};

test(".ics uses masjid local time with a time zone, a UTC UNTIL, and escaped text", () => {
  const ics = buildIcs(calEvent, TZ, new Date("2026-10-01T00:00:00Z"));
  assert.match(ics, /DTSTART;TZID=America\/Los_Angeles:20261002T130000\r\n/);
  assert.match(ics, /DTEND;TZID=America\/Los_Angeles:20261002T140000\r\n/);
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=FR;UNTIL=20270101T075900Z\r\n/);
  assert.match(ics, /BEGIN:VTIMEZONE\r\nTZID:America\/Los_Angeles/);
  assert.match(ics, /SUMMARY:Jumu'ah\\, weekly\\; khutbah\r\n/);
  assert.match(ics, /DESCRIPTION:Line one\\nLine two/);
  assert.ok(ics.split("\r\n").every((line) => Buffer.byteLength(line) <= 75), "lines are folded at 75 octets");
});

test("all-day events use DATE values", () => {
  const ics = buildIcs({ ...calEvent, allDay: true, rrule: null, rruleUntil: null }, TZ);
  assert.match(ics, /DTSTART;VALUE=DATE:20261002\r\n/);
  assert.match(ics, /DTEND;VALUE=DATE:20261003\r\n/);
  assert.doesNotMatch(ics, /VTIMEZONE/);
});

test("Google Calendar link carries local times, the time zone and the repeat", () => {
  const url = new URL(googleCalendarUrl(calEvent, TZ));
  assert.equal(url.searchParams.get("action"), "TEMPLATE");
  assert.equal(url.searchParams.get("dates"), "20261002T130000/20261002T140000");
  assert.equal(url.searchParams.get("ctz"), TZ);
  assert.equal(url.searchParams.get("recur"), "RRULE:FREQ=WEEKLY;BYDAY=FR;UNTIL=20270101T075900Z");
  assert.equal(url.searchParams.get("text"), calEvent.title);
});

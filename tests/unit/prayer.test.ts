// Unit tests for prayer-time logic. Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { masjidNow, nextPrayer, prayersForDay, type DaySchedule } from "../../src/lib/prayer/next-prayer";
import { applyIqamahRule, calculateAdhan, resolveDay, ruleFor, type IqamahRuleInput } from "../../src/lib/prayer/calculate";
import { zonedToUtc } from "../../src/lib/time";

const TZ = "America/Los_Angeles";
const settings = { latitude: 37.93, longitude: -121.7, timezone: TZ, calcMethod: "NorthAmerica", highLatRule: "MiddleOfTheNight" };

function day(date: string, weekday: number, jumuah = false): DaySchedule {
  return {
    date,
    weekday,
    prayers: [
      { key: "fajr", adhan: "05:47", iqamah: "06:05" },
      { key: "dhuhr", adhan: "12:59", iqamah: "13:29" },
      { key: "asr", adhan: "17:11", iqamah: "17:26" },
      { key: "maghrib", adhan: "18:56", iqamah: "19:01" },
      { key: "isha", adhan: "20:08", iqamah: "20:23" },
    ],
    jumuah: jumuah ? [{ label: "First Jumu'ah", khutbah: "13:00", iqamah: "13:20", location: "Main Hall" }] : [],
  };
}

test("next prayer is the first Adhan after now", () => {
  const sun = day("2026-09-27", 0);
  const mon = day("2026-09-28", 1);
  assert.deepEqual(nextPrayer(sun, mon, 4 * 60), { key: "fajr", time: "05:47", tomorrow: false });
  assert.deepEqual(nextPrayer(sun, mon, 13 * 60), { key: "asr", time: "17:11", tomorrow: false });
});

test("after Isha, the next prayer is tomorrow's Fajr", () => {
  const np = nextPrayer(day("2026-09-27", 0), day("2026-09-28", 1), 21 * 60);
  assert.deepEqual(np, { key: "fajr", time: "05:47", tomorrow: true });
});

test("on Fridays Jumu'ah replaces Dhuhr", () => {
  const fri = day("2026-10-02", 5, true);
  assert.deepEqual(prayersForDay(fri).map((p) => p.key), ["fajr", "jumuah", "asr", "maghrib", "isha"]);
  assert.deepEqual(nextPrayer(fri, day("2026-10-03", 6), 12 * 60 + 30), { key: "jumuah", time: "13:00", tomorrow: false });
  // Not Friday: Dhuhr stays even if a Jumu'ah list were present.
  assert.equal(prayersForDay({ ...fri, weekday: 4 })[1].key, "dhuhr");
});

test("masjid time is Los Angeles time, not the server's", () => {
  // 01:30 UTC on Sep 27 is still Sep 26, 6:30 PM in Brentwood.
  assert.deepEqual(masjidNow(TZ, new Date("2026-09-27T01:30:00Z")), { date: "2026-09-26", weekday: 6, minutes: 18 * 60 + 30 });
});

test("Iqamah rules: offset, fixed, and a fixed time never before the Adhan", () => {
  const base = { prayer: "isha" as const, effectiveFrom: "2026-01-01", effectiveTo: null };
  assert.equal(applyIqamahRule("20:08", { ...base, mode: "OFFSET", offsetMinutes: 15, fixedTime: null }), "20:23");
  assert.equal(applyIqamahRule("20:08", { ...base, mode: "FIXED", offsetMinutes: null, fixedTime: "21:00" }), "21:00");
  assert.equal(applyIqamahRule("21:10", { ...base, mode: "FIXED", offsetMinutes: null, fixedTime: "21:00" }), "21:10");
  assert.equal(applyIqamahRule("20:08", undefined), "20:08");
});

test("the rule with the latest start date that covers the day wins", () => {
  const rules: IqamahRuleInput[] = [
    { prayer: "isha", mode: "OFFSET", offsetMinutes: 15, fixedTime: null, effectiveFrom: "2026-01-01", effectiveTo: null },
    { prayer: "isha", mode: "FIXED", offsetMinutes: null, fixedTime: "21:00", effectiveFrom: "2026-10-05", effectiveTo: "2026-10-11" },
  ];
  assert.equal(ruleFor("isha", "2026-10-04", rules)?.mode, "OFFSET");
  assert.equal(ruleFor("isha", "2026-10-05", rules)?.mode, "FIXED");
  assert.equal(ruleFor("isha", "2026-10-11", rules)?.mode, "FIXED");
  assert.equal(ruleFor("isha", "2026-10-12", rules)?.mode, "OFFSET");
  assert.equal(ruleFor("fajr", "2026-10-05", rules), undefined);
});

test("an overridden Adhan still gets the Iqamah rule unless Iqamah is overridden too", () => {
  const rules: IqamahRuleInput[] = [
    { prayer: "maghrib", mode: "OFFSET", offsetMinutes: 5, fixedTime: null, effectiveFrom: "2026-01-01", effectiveTo: null },
  ];
  const a = resolveDay("2026-09-27", settings, rules, { maghribAdhan: "17:40" });
  assert.deepEqual(a.prayers[3], { key: "maghrib", adhan: "17:40", iqamah: "17:45" });
  assert.deepEqual(a.overridden, ["maghribAdhan"]);
  const b = resolveDay("2026-09-27", settings, rules, { maghribAdhan: "17:40", maghribIqamah: "18:00" });
  assert.equal(b.prayers[3].iqamah, "18:00");
});

test("Brentwood times: Hanafi Asr and the daylight-saving change", () => {
  const sep27 = calculateAdhan("2026-09-27", settings);
  assert.equal(sep27.asr, "17:11"); // Hanafi (the standard method would be about 16:21)
  assert.ok(sep27.fajr < sep27.dhuhr && sep27.dhuhr < sep27.asr && sep27.asr < sep27.maghrib && sep27.maghrib < sep27.isha);
  // DST ends Sunday Nov 1, 2026: clocks go back an hour.
  assert.equal(calculateAdhan("2026-10-31", settings).dhuhr, "12:51");
  assert.equal(calculateAdhan("2026-11-01", settings).dhuhr, "11:51");
});

test("masjid-local wall time converts to the right UTC instant across DST", () => {
  assert.equal(zonedToUtc("2026-07-03", "13:00", TZ).toISOString(), "2026-07-03T20:00:00.000Z"); // PDT, UTC-7
  assert.equal(zonedToUtc("2026-12-04", "13:00", TZ).toISOString(), "2026-12-04T21:00:00.000Z"); // PST, UTC-8
});

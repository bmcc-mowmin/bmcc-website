// Pure prayer-time calculation (no database), so it can be unit tested.
//
//   calculated Adhan (adhan-js, Hanafi Asr)
//     → per-day admin override of any Adhan/Iqamah
//     → Iqamah from the admin's rule (offset after Adhan, or a fixed time)
import { CalculationMethod, Coordinates, HighLatitudeRule, Madhab, PrayerTimes } from "adhan";
import type { JumuahService, PrayerKey, PrayerTime } from "./next-prayer";
import { toMinutes } from "./next-prayer";

export const DAILY_PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type DailyPrayer = (typeof DAILY_PRAYERS)[number];

export const CALC_METHODS = Object.keys(CalculationMethod) as (keyof typeof CalculationMethod)[];
export const HIGH_LAT_RULES = ["MiddleOfTheNight", "SeventhOfTheNight", "TwilightAngle"] as const;

export type CalcSettings = {
  latitude: number;
  longitude: number;
  timezone: string;
  calcMethod: string;
  highLatRule: string;
};

export type IqamahRuleInput = {
  prayer: DailyPrayer;
  mode: "OFFSET" | "FIXED";
  offsetMinutes: number | null;
  fixedTime: string | null;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo: string | null;
};

export type DayOverrideInput = Partial<Record<`${DailyPrayer}${"Adhan" | "Iqamah"}`, string | null>> & {
  jumuah?: JumuahService[] | null;
  note?: string | null;
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isClock = (v: unknown): v is string => typeof v === "string" && HHMM.test(v);

export function fromMinutes(total: number) {
  const m = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function clockInZone(instant: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instant);
}

// Adhan times ("HH:mm", masjid-local) for a masjid-local calendar date.
export function calculateAdhan(date: string, s: CalcSettings): Record<DailyPrayer, string> {
  const [y, m, d] = date.split("-").map(Number);
  const methodFactory = CalculationMethod[s.calcMethod as keyof typeof CalculationMethod] ?? CalculationMethod.NorthAmerica;
  const params = methodFactory();
  params.madhab = Madhab.Hanafi; // BMCC: Asr when an object's shadow is twice its length
  const rule = { MiddleOfTheNight: HighLatitudeRule.MiddleOfTheNight, SeventhOfTheNight: HighLatitudeRule.SeventhOfTheNight, TwilightAngle: HighLatitudeRule.TwilightAngle }[s.highLatRule];
  if (rule) params.highLatitudeRule = rule;
  // adhan-js reads the calendar parts of this Date, so build it from the masjid-local date.
  const times = new PrayerTimes(new Coordinates(s.latitude, s.longitude), new Date(y, m - 1, d), params);
  return {
    fajr: clockInZone(times.fajr, s.timezone),
    dhuhr: clockInZone(times.dhuhr, s.timezone),
    asr: clockInZone(times.asr, s.timezone),
    maghrib: clockInZone(times.maghrib, s.timezone),
    isha: clockInZone(times.isha, s.timezone),
  };
}

// The rule in force for this prayer on this date: the latest effectiveFrom that covers it.
export function ruleFor(prayer: DailyPrayer, date: string, rules: IqamahRuleInput[]) {
  return rules
    .filter((r) => r.prayer === prayer && r.effectiveFrom <= date && (!r.effectiveTo || r.effectiveTo >= date))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}

export function applyIqamahRule(adhan: string, rule: IqamahRuleInput | undefined) {
  if (!rule) return adhan;
  if (rule.mode === "FIXED" && isClock(rule.fixedTime)) {
    // A fixed Iqamah can never be before the Adhan (e.g. after a DST change).
    return toMinutes(rule.fixedTime) >= toMinutes(adhan) ? rule.fixedTime : adhan;
  }
  return fromMinutes(toMinutes(adhan) + (rule.offsetMinutes ?? 0));
}

// One day's five prayers with overrides applied. `overridden` lists fields an admin set.
export function resolveDay(
  date: string,
  settings: CalcSettings,
  rules: IqamahRuleInput[],
  override: DayOverrideInput | null,
): { prayers: PrayerTime[]; overridden: string[] } {
  const calculated = calculateAdhan(date, settings);
  const overridden: string[] = [];
  const prayers = DAILY_PRAYERS.map((key) => {
    const adhanOverride = override?.[`${key}Adhan`];
    const iqamahOverride = override?.[`${key}Iqamah`];
    const adhan = isClock(adhanOverride) ? adhanOverride : calculated[key];
    if (isClock(adhanOverride)) overridden.push(`${key}Adhan`);
    // An overridden Adhan still gets the normal Iqamah rule unless the Iqamah is overridden too.
    const iqamah = isClock(iqamahOverride) ? iqamahOverride : applyIqamahRule(adhan, ruleFor(key, date, rules));
    if (isClock(iqamahOverride)) overridden.push(`${key}Iqamah`);
    return { key: key as PrayerKey, adhan, iqamah };
  });
  return { prayers, overridden };
}

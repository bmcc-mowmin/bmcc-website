import "server-only";
import { db } from "@/lib/db";
import type { PrayerTime } from "../next-prayer";

// Where the daily Adhan/Iqamah times come from.
//   builtin → calculated (Hanafi Asr) + admin Iqamah rules + day overrides (src/lib/prayer/schedule.ts)
//   masjidi → the masjid's Masjidi account, once Masjidi provides API access. Until then it is
//             listed but unavailable, and the site keeps using the built-in times.
// Whatever the source, schedule.ts stays the single place every page reads from.

export type ExternalDay = { prayers: PrayerTime[] };

export interface ExternalPrayerSource {
  id: string;
  label: string;
  available: boolean;
  unavailableReason?: string;
  getDay(date: string): Promise<ExternalDay>;
}

const masjidi: ExternalPrayerSource = {
  id: "masjidi",
  label: "Masjidi",
  available: false,
  unavailableReason:
    "Masjidi does not publish an API for websites yet. Ask Masjidi (support@masjidi.app) for API access; once they provide it, this source can be connected and switched on here.",
  async getDay() {
    throw new Error("The Masjidi source is not connected yet.");
  },
};

export const EXTERNAL_SOURCES: ExternalPrayerSource[] = [masjidi];

export const SOURCE_OPTIONS = [
  { id: "builtin", label: "Built-in (calculated + admin overrides)", available: true, unavailableReason: undefined as string | undefined },
  ...EXTERNAL_SOURCES.map((s) => ({ id: s.id, label: s.label, available: s.available, unavailableReason: s.unavailableReason })),
];

export function externalSource(id: string) {
  return EXTERNAL_SOURCES.find((s) => s.id === id && s.available) ?? null;
}

export async function getPrayerSourceStatus() {
  const settings = await db.prayerSettings.findUnique({ where: { id: 1 }, select: { source: true } });
  const id = settings?.source ?? "builtin";
  if (id === "builtin") return { id, label: "Built-in", ok: true, message: "Calculated times with admin overrides." };
  const src = EXTERNAL_SOURCES.find((s) => s.id === id);
  if (!src?.available) return { id, label: "Built-in (fallback)", ok: false, message: `${src?.label ?? id} isn't connected, so the built-in times are shown.` };
  return { id, label: src.label, ok: true, message: `Times come from ${src.label}.` };
}

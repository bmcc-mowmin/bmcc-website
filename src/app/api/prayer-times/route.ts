import { NextRequest } from "next/server";
import { getDaySchedule, masjidClock } from "@/lib/prayer/schedule";
import { isLang } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

// GET /api/prayer-times?date=YYYY-MM-DD[&lang=urdu]
// → { date, timezone, prayers:[{key, adhan, iqamah}], jumuah:[{label, khutbah, iqamah, location}] }
// Times are "HH:mm" (24h) in the masjid's time zone. Defaults to today at the masjid.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const { date: today, timeZone } = await masjidClock();
  const date = params.get("date") ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) {
    return Response.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  const langParam = params.get("lang");
  const lang = isLang(langParam) ? langParam : "en";
  const day = await getDaySchedule(date, lang);
  return Response.json(
    {
      date: day.date,
      timezone: timeZone,
      prayers: day.prayers,
      jumuah: day.jumuah.map(({ label, khutbah, iqamah, location }) => ({ label, khutbah, iqamah, location })),
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}

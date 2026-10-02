import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getOrg } from "@/lib/org";
import { storage } from "@/lib/storage";
import { getMonthSchedule, masjidClock } from "@/lib/prayer/schedule";
import { renderTimetablePdf } from "@/lib/prayer/timetable-pdf";

export const dynamic = "force-dynamic";

// GET /api/prayer-times/pdf?month=YYYY-MM (defaults to the current month at the masjid).
// Serves the admin-uploaded PDF for that month if there is one, otherwise generates it.
export async function GET(req: NextRequest) {
  const clock = await masjidClock();
  const month = req.nextUrl.searchParams.get("month") ?? clock.date.slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return Response.json({ error: "month must be YYYY-MM" }, { status: 400 });
  }
  const filename = `bmcc-prayer-times-${month}.pdf`;
  const headers = {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${filename}"`,
    "Cache-Control": "public, max-age=600",
  };

  const uploaded = await db.timetablePdf.findUnique({ where: { month } });
  if (uploaded) {
    const file = await storage.get(uploaded.storageKey);
    if (file) return new Response(new Uint8Array(file), { headers });
  }

  const [days, org] = await Promise.all([getMonthSchedule(month, "en"), getOrg()]);
  const generatedAt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: clock.timeZone }).format(new Date());
  const pdf = await renderTimetablePdf({
    month,
    days,
    generatedAt,
    org: { name: org.legalName, address: org.address, phone: org.phone, url: env.APP_URL.replace(/^https?:\/\//, "") },
  });
  return new Response(new Uint8Array(pdf), { headers });
}

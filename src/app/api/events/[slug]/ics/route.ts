import { NextRequest } from "next/server";
import { getCalendarEvent } from "@/lib/events";
import { buildIcs } from "@/lib/events/calendar";
import { isLang } from "@/lib/i18n/config";

// GET /api/events/<slug>/ics[?lang=urdu] → an .ics file for "+ iCal" (Apple, Outlook, …).
export async function GET(req: NextRequest, { params }: RouteContext<"/api/events/[slug]/ics">) {
  const { slug } = await params;
  const langParam = req.nextUrl.searchParams.get("lang");
  const event = await getCalendarEvent(slug, isLang(langParam) ? langParam : "en");
  if (!event) return new Response("Not found", { status: 404 });
  return new Response(buildIcs(event, event.timeZone), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="bmcc-${slug}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}

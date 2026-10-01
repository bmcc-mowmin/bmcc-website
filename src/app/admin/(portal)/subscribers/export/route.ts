import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import { toCsv } from "@/lib/directory/csv";
import { audit } from "@/lib/audit";
import { unsubscribeUrl } from "@/lib/mailing-list";

// The confirmed list, for importing into the newsletter tool. Only people who confirmed are exported.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user.adminRoles, "subscribers")) return new Response("Forbidden", { status: 403 });
  const rows = await db.subscriber.findMany({ where: { status: "CONFIRMED" }, orderBy: { confirmedAt: "asc" } });
  const csv = toCsv(
    ["email", "language", "source", "confirmed at", "unsubscribe url"],
    rows.map((r) => [r.email, r.lang, r.source, r.confirmedAt?.toISOString() ?? "", unsubscribeUrl(r.unsubscribeToken)]),
  );
  await audit(user.id, "export", "Subscriber", "confirmed", { count: rows.length });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bmcc-subscribers-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

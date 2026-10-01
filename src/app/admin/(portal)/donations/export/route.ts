import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import { masjidClock } from "@/lib/prayer/schedule";
import { toCsv } from "@/lib/directory/csv";
import { FUND_LABELS, isFund } from "@/lib/payments/catalog";
import { paymentWhere, readFilters } from "@/lib/payments/report";

// CSV of payments with the same filters as Admin → Donations.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user.adminRoles, "donations")) return new Response("Forbidden", { status: 403 });
  const { timeZone } = await masjidClock();
  const filters = readFilters(Object.fromEntries(req.nextUrl.searchParams));
  const rows = await db.payment.findMany({ where: paymentWhere(filters, timeZone), orderBy: { paidAt: "asc" } });
  const day = new Intl.DateTimeFormat("en-CA", { timeZone });
  const csv = toCsv(
    ["date", "receipt number", "name", "email", "type", "fund", "frequency", "amount (USD)", "provider", "provider payment id"],
    rows.map((p) => [
      p.paidAt ? day.format(p.paidAt) : "",
      p.receiptNumber,
      p.donorName,
      p.donorEmail,
      p.kind === "DUES" ? "membership dues" : "donation",
      isFund(p.fund) ? FUND_LABELS[p.fund] : "",
      p.frequency.toLowerCase().replace("_", "-"),
      (p.amountCents / 100).toFixed(2),
      p.provider,
      p.providerPaymentId,
    ]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bmcc-payments-${day.format(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

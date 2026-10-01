import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { zonedToUtc } from "@/lib/time";
import { isFund } from "./catalog";

// Filters for Admin → Donations (the page and its CSV export use the same ones).
export type PaymentFilters = { kind: string; fund: string; from: string; to: string; q: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function readFilters(p: Record<string, string | string[] | undefined>): PaymentFilters {
  const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string).trim() : "");
  return { kind: s("kind"), fund: s("fund"), from: s("from"), to: s("to"), q: s("q") };
}

export function paymentWhere(f: PaymentFilters, timeZone: string): Prisma.PaymentWhereInput {
  const paidAt: Prisma.DateTimeNullableFilter = {};
  if (DATE.test(f.from)) paidAt.gte = zonedToUtc(f.from, "00:00", timeZone);
  if (DATE.test(f.to)) paidAt.lt = new Date(zonedToUtc(f.to, "00:00", timeZone).getTime() + 86_400_000);
  return {
    status: "SUCCEEDED",
    ...(f.kind === "DONATION" || f.kind === "DUES" ? { kind: f.kind } : {}),
    ...(isFund(f.fund) ? { fund: f.fund } : {}),
    ...(paidAt.gte || paidAt.lt ? { paidAt } : {}),
    ...(f.q
      ? {
          OR: [
            { donorEmail: { contains: f.q, mode: "insensitive" } },
            { donorName: { contains: f.q, mode: "insensitive" } },
            { receiptNumber: { contains: f.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export function filterQuery(f: PaymentFilters) {
  return new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
}

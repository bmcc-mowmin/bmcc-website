// Funeral Services Benefit coverage, per the policy page:
//  • coverage starts 6 months after enrollment (= the first successful dues payment);
//  • a missed payment starts a 30-day grace period from the due date; after it, coverage pauses;
//  • coverage resumes once dues are current — the grace period never waives the waiting period.
// Pure functions (no database) so they can be unit tested. Status is computed when read, so no
// scheduled job is needed to "expire" a grace period.

import { zonedDate, zonedToUtc } from "@/lib/time";

export const WAITING_MONTHS = 6;
export const GRACE_DAYS = 30;
export const BENEFIT_MAX_USD = 10_000;

// 6 calendar months after the enrollment DATE at the masjid; coverage starts at local midnight.
// e.g. paid Sep 30 at 8 PM in Brentwood → covered from Mar 30, 00:00 Pacific.
export function benefitEligibleFrom(enrolledAt: Date, timeZone = "America/Los_Angeles") {
  const [y, m, d] = zonedDate(enrolledAt, timeZone).split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + WAITING_MONTHS, 1));
  // Aug 31 + 6 months → Feb 28/29 (the last day of the month), not Mar 3.
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return zonedToUtc(target.toISOString().slice(0, 10), "00:00", timeZone);
}

export function graceEndsAt(dueAt: Date) {
  return new Date(dueAt.getTime() + GRACE_DAYS * 86_400_000);
}

export type Coverage = "not_enrolled" | "waiting" | "covered" | "grace" | "paused" | "canceled";

type MembershipLike = {
  status: "PENDING_PAYMENT" | "ACTIVE" | "PAST_DUE" | "PAUSED" | "CANCELLED";
  benefitEligibleFrom: Date | null;
  graceEndsAt: Date | null;
};

export function coverage(m: MembershipLike, now = new Date()): Coverage {
  if (m.status === "PENDING_PAYMENT" || !m.benefitEligibleFrom) return "not_enrolled";
  if (m.status === "CANCELLED") return "canceled";
  if (m.status === "PAUSED") return "paused";
  if (m.status === "PAST_DUE") {
    if (m.graceEndsAt && now > m.graceEndsAt) return "paused";
    return now < m.benefitEligibleFrom ? "waiting" : "grace";
  }
  return now < m.benefitEligibleFrom ? "waiting" : "covered";
}

export const COVERAGE_LABEL: Record<Coverage, string> = {
  not_enrolled: "Not active — dues not paid yet",
  waiting: "Waiting period (benefit not yet available)",
  covered: "Covered",
  grace: "Covered — in 30-day grace period (payment missed)",
  paused: "Paused — dues overdue past the grace period",
  canceled: "Canceled",
};

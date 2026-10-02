import "server-only";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";

// What the member portal shows for the signed-in person. Records are matched by the account AND
// by email, so a gift made before the account existed still shows up.

const mine = (user: CurrentUser) => ({ email: user.email.toLowerCase(), id: user.id });

export async function getMyMemberships(user: CurrentUser) {
  const { email, id } = mine(user);
  return db.membership.findMany({
    where: { household: { OR: [{ primaryUserId: id }, { email }] } },
    orderBy: { appliedAt: "desc" },
    include: {
      household: { include: { members: { orderBy: { createdAt: "asc" } } } },
      subscriptions: { where: { status: { not: "CANCELED" } }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}

// The household the person manages (from their most recent membership).
export async function getMyHousehold(user: CurrentUser) {
  const [latest] = await getMyMemberships(user);
  return latest ? { household: latest.household, membership: latest } : null;
}

export async function getMyPayments(user: CurrentUser) {
  const { email, id } = mine(user);
  return db.payment.findMany({
    where: { status: { in: ["SUCCEEDED", "REFUNDED"] }, OR: [{ userId: id }, { donorEmail: email }] },
    orderBy: { paidAt: "desc" },
  });
}

export async function getMyPayment(user: CurrentUser, paymentId: string) {
  const { email, id } = mine(user);
  return db.payment.findFirst({ where: { id: paymentId, status: { in: ["SUCCEEDED", "REFUNDED"] }, OR: [{ userId: id }, { donorEmail: email }] } });
}

// Monthly donations the person can stop themselves (membership dues are changed with the office).
export async function getMyRecurringGifts(user: CurrentUser) {
  const { email, id } = mine(user);
  return db.subscription.findMany({ where: { kind: "DONATION", status: { not: "CANCELED" }, OR: [{ userId: id }, { email }] }, orderBy: { createdAt: "desc" } });
}

export async function getMyRsvps(user: CurrentUser, now = new Date()) {
  return db.eventRsvp.findMany({
    where: { userId: user.id, occurrenceStart: { gte: new Date(now.getTime() - 6 * 3600_000) } },
    orderBy: { occurrenceStart: "asc" },
    include: { event: true },
  });
}

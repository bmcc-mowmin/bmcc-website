import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { isStaff } from "@/lib/auth/permissions";
import { handlePaymentEvent } from "@/lib/payments/events";
import { providerById } from "@/lib/payments/provider";

// "Erase a person" for a deletion request (Admin → Privacy requests).
//
//   Deleted:     the account, household members (names, birth dates), RSVPs, mailing-list entry,
//                contact messages, the Clerk sign-in account.
//   Anonymized:  payments and receipts — amount, date, fund and receipt number stay for BMCC's
//                financial records; the name becomes "Deleted donor" and the email a placeholder.
//                Same for recurring-gift records, checkouts and the household's address/contact.
//   Cancelled:   any active monthly gift or dues subscription, at the provider first, so nobody
//                keeps being charged under an erased record.
//                Activity-log entries keep their record but lose any details that mention the email.
//   Not changed: someone else's household that lists this email for a member, and directory
//                listings whose public contact email is this address — shown for manual handling.
// Staff accounts must have their admin access removed first (Admin users).

export const DELETED_DONOR = "Deleted donor";
const norm = (email: string) => email.trim().toLowerCase();

async function find(emailRaw: string) {
  const email = norm(emailRaw);
  const user = await db.user.findUnique({ where: { email } });
  const mine = user ? [{ userId: user.id }] : [];

  const households = await db.household.findMany({
    where: { OR: [...(user ? [{ primaryUserId: user.id }] : []), { email }] },
    include: { members: { select: { id: true } }, memberships: { select: { id: true, status: true } } },
  });
  const householdIds = households.map((h) => h.id);
  const [payments, subscriptions, checkouts, subscriber, messages, rsvps, submittedListings, listingsWithEmail, otherHouseholds] = await Promise.all([
    db.payment.count({ where: { OR: [...mine, { donorEmail: email }] } }),
    db.subscription.findMany({ where: { OR: [...mine, { email }] }, select: { id: true, provider: true, providerSubscriptionId: true, status: true, kind: true } }),
    db.checkoutSession.count({ where: { OR: [...mine, { email }] } }),
    db.subscriber.findUnique({ where: { email }, select: { id: true } }),
    db.contactMessage.count({ where: { email } }),
    user ? db.eventRsvp.count({ where: { userId: user.id } }) : 0,
    db.directoryListing.count({ where: { submitterEmail: email } }),
    db.directoryListing.findMany({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, name: true } }),
    db.householdMember.count({ where: { email: { equals: email, mode: "insensitive" }, householdId: { notIn: householdIds } } }),
  ]);
  return { email, user, households, householdIds, payments, subscriptions, checkouts, subscriber, messages, rsvps, submittedListings, listingsWithEmail, otherHouseholds };
}

export type ErasePreview = {
  email: string;
  found: boolean;
  blockedReason?: string;
  account: boolean;
  signInAccount: boolean;
  households: number;
  householdMembers: number;
  memberships: number;
  payments: number;
  activeSubscriptions: number;
  subscriptions: number;
  checkouts: number;
  subscriber: boolean;
  messages: number;
  rsvps: number;
  submittedListings: number;
  listingsWithEmail: { id: string; name: string }[];
  otherHouseholds: number;
};

export async function previewErase(emailRaw: string, adminId: string): Promise<ErasePreview> {
  const f = await find(emailRaw);
  const activeSubscriptions = f.subscriptions.filter((s) => s.status !== "CANCELED").length;
  const preview: ErasePreview = {
    email: f.email,
    account: !!f.user,
    signInAccount: !!f.user?.clerkUserId,
    households: f.households.length,
    householdMembers: f.households.reduce((n, h) => n + h.members.length, 0),
    memberships: f.households.reduce((n, h) => n + h.memberships.length, 0),
    payments: f.payments,
    activeSubscriptions,
    subscriptions: f.subscriptions.length,
    checkouts: f.checkouts,
    subscriber: !!f.subscriber,
    messages: f.messages,
    rsvps: f.rsvps,
    submittedListings: f.submittedListings,
    listingsWithEmail: f.listingsWithEmail,
    otherHouseholds: f.otherHouseholds,
    found: false,
  };
  preview.found = !!(f.user || f.households.length || f.payments || f.subscriptions.length || f.checkouts || f.subscriber || f.messages || f.submittedListings);
  if (f.user && f.user.id === adminId) preview.blockedReason = "You can't erase your own account.";
  else if (f.user && isStaff(f.user.adminRoles)) preview.blockedReason = "This person has admin access. Remove it in Admin users first, then erase.";
  return preview;
}

export type EraseResult = { ok: true; summary: string; warnings: string[] } | { ok: false; message: string };

export async function erasePerson(emailRaw: string, admin: { id: string }): Promise<EraseResult> {
  const preview = await previewErase(emailRaw, admin.id);
  if (preview.blockedReason) return { ok: false, message: preview.blockedReason };
  if (!preview.found) return { ok: false, message: "Nothing is stored for that email." };
  const f = await find(emailRaw);
  const warnings: string[] = [];

  // 1. Stop recurring charges at the provider before anything is anonymized.
  for (const s of f.subscriptions.filter((x) => x.status !== "CANCELED")) {
    try {
      await providerById(s.provider).cancelSubscription(s.providerSubscriptionId);
    } catch (e) {
      console.error("erase: cancelling subscription failed", s.id, e);
      return { ok: false, message: `Couldn't cancel a ${s.kind === "DUES" ? "dues" : "monthly gift"} subscription at ${s.provider}. Nothing was erased; cancel it in the ${s.provider} dashboard, then try again.` };
    }
    await handlePaymentEvent({ type: "subscription.canceled", eventId: `erase_cancel_${s.id}`, providerSubscriptionId: s.providerSubscriptionId, canceledAt: new Date() }, s.provider);
  }

  // 2. Delete and anonymize, all-or-nothing.
  const placeholder = `erased-${randomBytes(6).toString("hex")}@erased.invalid`;
  const userId = f.user?.id;
  const mine = userId ? [{ userId }] : [];
  await db.$transaction(async (tx) => {
    await tx.payment.updateMany({ where: { OR: [...mine, { donorEmail: f.email }] }, data: { donorName: DELETED_DONOR, donorEmail: placeholder, userId: null } });
    await tx.subscription.updateMany({ where: { OR: [...mine, { email: f.email }] }, data: { email: placeholder, name: null, userId: null, providerCustomerId: null } });
    await tx.checkoutSession.updateMany({ where: { OR: [...mine, { email: f.email }] }, data: { email: null, name: null, userId: null } });
    if (f.householdIds.length) {
      await tx.householdMember.deleteMany({ where: { householdId: { in: f.householdIds } } });
      await tx.membership.updateMany({ where: { householdId: { in: f.householdIds } }, data: { notes: null } });
      await tx.membership.updateMany({ where: { householdId: { in: f.householdIds }, status: { not: "CANCELLED" } }, data: { status: "CANCELLED" } });
      await tx.household.updateMany({
        where: { id: { in: f.householdIds } },
        data: { primaryUserId: null, addressLine1: "", addressLine2: null, city: "", state: "", zip: "", phone: "", email: placeholder, emergencyName: "", emergencyPhone: "" },
      });
    }
    await tx.subscriber.deleteMany({ where: { email: f.email } });
    await tx.contactMessage.deleteMany({ where: { email: f.email } });
    await tx.directoryListing.updateMany({ where: { submitterEmail: f.email }, data: { submitterEmail: null } });
    // Older activity-log entries that mention the email in their details (e.g. an unsubscribe):
    // keep the entry, drop the details.
    await tx.$executeRaw`UPDATE "AuditLog" SET "diff" = NULL WHERE "diff"::text ILIKE ${"%" + f.email + "%"}`;
    if (userId) {
      await tx.eventRsvp.deleteMany({ where: { userId } });
      await tx.auditLog.updateMany({ where: { actorId: userId }, data: { actorId: null } });
      await tx.user.delete({ where: { id: userId } }); // sign-in tokens go with it
    }
  });

  // 3. The Clerk sign-in account.
  if (f.user?.clerkUserId && env.AUTH_PROVIDER === "clerk") {
    try {
      const { clerkClient } = await import("@clerk/nextjs/server");
      await (await clerkClient()).users.deleteUser(f.user.clerkUserId);
    } catch (e) {
      console.error("erase: deleting the Clerk user failed", e);
      warnings.push("The Clerk sign-in account couldn't be deleted — delete it in the Clerk dashboard (Users).");
    }
  }
  if (preview.listingsWithEmail.length) warnings.push(`Review ${preview.listingsWithEmail.length} directory listing(s) that show this email publicly.`);
  if (preview.otherHouseholds) warnings.push(`This email is listed for a member of ${preview.otherHouseholds} other household(s); that household's primary member or the office decides about it.`);

  // The activity log records that an erasure happened — never the email itself (only a hash, so a
  // later "was I erased?" question can be answered).
  const emailHash = createHash("sha256").update(f.email).digest("hex");
  await audit(admin.id, "erase", "Person", emailHash.slice(0, 16), {
    emailSha256: emailHash,
    payments: preview.payments,
    householdMembers: preview.householdMembers,
    subscriptionsCancelled: preview.activeSubscriptions,
    account: preview.account,
  });

  const summary = `Erased. ${preview.payments} payment(s) kept anonymously as "${DELETED_DONOR}"; ${preview.householdMembers} household member(s), ${preview.rsvps} RSVP(s) and ${preview.messages} message(s) deleted${preview.activeSubscriptions ? `; ${preview.activeSubscriptions} subscription(s) cancelled` : ""}.`;
  return { ok: true, summary, warnings };
}

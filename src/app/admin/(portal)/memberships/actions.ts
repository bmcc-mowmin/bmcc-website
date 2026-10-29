"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSection, type CurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { done, fail, text } from "@/lib/admin/forms";
import { handlePaymentEvent } from "@/lib/payments/events";
import { isMockPayments, providerById } from "@/lib/payments/provider";
import type { ActionResult } from "@/components/admin/ActionForm";

const RELATIONSHIPS = ["SELF", "SPOUSE", "CHILD", "PARENT", "SIBLING", "OTHER"] as const;
const refresh = (id?: string) => {
  revalidatePath("/admin/memberships");
  if (id) revalidatePath(`/admin/memberships/${id}`);
  revalidatePath("/admin/donations");
};

export async function saveMembershipAdmin(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireSection("memberships");
  const id = text(form, "id");
  const membershipNumber = text(form, "membershipNumber") || null;
  const notes = text(form, "notes").slice(0, 2000) || null;
  if (membershipNumber && !/^[A-Za-z0-9-]{1,30}$/.test(membershipNumber)) return fail("Membership ID: letters, numbers and dashes only.");
  if (membershipNumber && (await db.membership.findFirst({ where: { membershipNumber, NOT: { id } } }))) {
    return fail(`Membership ID ${membershipNumber} is already used by another membership.`);
  }
  await db.membership.update({ where: { id }, data: { membershipNumber, notes } });
  await audit(admin.id, "update", "Membership", id, { membershipNumber, notes });
  refresh(id);
  return done("Saved.");
}

const memberSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  relationship: z.enum(RELATIONSHIPS),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

// The household members are the people eligible for the Funeral Services Benefit.
export async function saveHouseholdMember(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireSection("memberships");
  const membershipId = text(form, "membershipId");
  const memberId = text(form, "memberId");
  const m = await db.membership.findUnique({ where: { id: membershipId } });
  if (!m) return fail("Membership not found.");
  const parsed = memberSchema.safeParse({ fullName: form.get("fullName"), relationship: form.get("relationship"), dateOfBirth: form.get("dateOfBirth") ?? "" });
  if (!parsed.success) return fail("Enter a full name and relationship (and a valid date of birth, if given).");
  const data = {
    fullName: parsed.data.fullName,
    relationship: parsed.data.relationship,
    dateOfBirth: parsed.data.dateOfBirth ? new Date(`${parsed.data.dateOfBirth}T00:00:00Z`) : null,
  };
  const saved = memberId
    ? await db.householdMember.update({ where: { id: memberId, householdId: m.householdId }, data })
    : await db.householdMember.create({ data: { ...data, householdId: m.householdId } });
  await audit(admin.id, memberId ? "update" : "create", "HouseholdMember", saved.id, { membershipId, ...data });
  refresh(membershipId);
  return done(memberId ? "Saved." : `Added ${saved.fullName} to the household.`);
}

export async function removeHouseholdMember(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireSection("memberships");
  const membershipId = text(form, "membershipId");
  const memberId = text(form, "memberId");
  const m = await db.membership.findUnique({ where: { id: membershipId } });
  const member = m && (await db.householdMember.findFirst({ where: { id: memberId, householdId: m.householdId } }));
  if (!member) return fail("Not found.");
  if (member.relationship === "SELF") return fail("The primary member can't be removed.");
  await db.householdMember.delete({ where: { id: memberId } });
  await audit(admin.id, "delete", "HouseholdMember", memberId, { membershipId, fullName: member.fullName });
  refresh(membershipId);
  return done(`Removed ${member.fullName}.`);
}

// Cancel a membership: stop the recurring dues with the payment provider and mark it cancelled.
export async function cancelMembership(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireSection("memberships");
  const id = text(form, "id");
  const m = await db.membership.findUnique({ where: { id } });
  if (!m) return fail("Not found.");
  const sub = m.providerSubscriptionId ? await db.subscription.findUnique({ where: { providerSubscriptionId: m.providerSubscriptionId } }) : null;
  if (sub && sub.status !== "CANCELED") {
    await providerById(sub.provider).cancelSubscription(sub.providerSubscriptionId);
    await handlePaymentEvent({ type: "subscription.canceled", eventId: `admin_cancel_${randomBytes(6).toString("hex")}`, providerSubscriptionId: sub.providerSubscriptionId, canceledAt: new Date() }, sub.provider);
  } else {
    await db.membership.update({ where: { id }, data: { status: "CANCELLED" } });
  }
  await audit(admin.id, "cancel", "Membership", id);
  refresh(id);
  return done("Membership cancelled; no further dues will be charged.");
}

// ── Test-mode tools (PAYMENT_PROVIDER=mock only) ─────────────────────────────
// Stand in for what Stripe will do on its own: renew, fail a renewal, or cancel.

async function subscriptionFor(form: FormData): Promise<{ admin: CurrentUser; sub: NonNullable<Awaited<ReturnType<typeof db.subscription.findUnique>>> } | string> {
  if (!isMockPayments()) return "Test tools are only available with the mock payment provider.";
  const sub = await db.subscription.findUnique({ where: { id: text(form, "subscriptionId") } });
  if (!sub) return "Subscription not found.";
  // Dues: membership coordinators. Recurring donations: super admins (treasurers are read-only).
  const admin = sub.kind === "DUES" ? await requireSection("memberships") : await requireSection("settings");
  return { admin, sub };
}

const evt = () => `mock_evt_${randomBytes(9).toString("base64url")}`;

export async function simulateRenewal(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const r = await subscriptionFor(form);
  if (typeof r === "string") return fail(r);
  const { admin, sub } = r;
  const paidAt = sub.currentPeriodEnd > new Date() ? sub.currentPeriodEnd : new Date();
  const next = new Date(paidAt);
  if (sub.interval === "YEAR") next.setUTCFullYear(next.getUTCFullYear() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  await handlePaymentEvent(
    { type: "invoice.paid", eventId: evt(), providerSubscriptionId: sub.providerSubscriptionId, providerPaymentId: `mock_pi_${randomBytes(9).toString("base64url")}`, paidAt, currentPeriodEnd: next },
    sub.provider,
  );
  await audit(admin.id, "simulate_renewal", "Subscription", sub.id);
  refresh(sub.membershipId ?? undefined);
  return done("Simulated a successful renewal payment (receipt emailed).");
}

export async function simulateFailedPayment(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const r = await subscriptionFor(form);
  if (typeof r === "string") return fail(r);
  const { admin, sub } = r;
  await handlePaymentEvent({ type: "invoice.failed", eventId: evt(), providerSubscriptionId: sub.providerSubscriptionId, dueAt: new Date() }, sub.provider);
  await audit(admin.id, "simulate_failed_payment", "Subscription", sub.id);
  refresh(sub.membershipId ?? undefined);
  return done("Simulated a failed payment — the 30-day grace period started today.");
}

// Test only: move the grace period's end into the past to see coverage pause without waiting.
export async function simulateGraceExpired(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const r = await subscriptionFor(form);
  if (typeof r === "string") return fail(r);
  const { admin, sub } = r;
  if (!sub.membershipId) return fail("Not a membership subscription.");
  await db.membership.update({ where: { id: sub.membershipId }, data: { graceEndsAt: new Date(Date.now() - 60_000) } });
  await audit(admin.id, "simulate_grace_expired", "Membership", sub.membershipId);
  refresh(sub.membershipId);
  return done("Grace period ended (simulated) — coverage is now paused until dues are paid.");
}

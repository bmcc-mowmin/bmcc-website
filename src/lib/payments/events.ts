import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { Prisma } from "@/generated/prisma/client";
import { benefitEligibleFrom, graceEndsAt } from "@/lib/membership/coverage";
import { escapeHtml, layoutHtml, sendMail } from "@/lib/mail";
import { emailReceipt, nextReceiptNumber } from "./receipts";
import { DUES, usd } from "./catalog";
import type { PaymentEvent } from "./types";

// THE place where money events change our records — for every provider (mock now, Stripe at
// go-live via its webhook). Each event id is processed once, even if the provider sends it twice.
// Emails are sent after the database work and never make an event fail.

type Tx = Prisma.TransactionClient;

export async function handlePaymentEvent(event: PaymentEvent, provider: string) {
  const after: (() => Promise<void>)[] = [];
  try {
    // All-or-nothing: the "processed" marker and every record change commit together, so a failure
    // part-way leaves nothing behind and the provider's retry is processed normally.
    await db.$transaction(async (tx) => {
      await tx.processedWebhookEvent.create({ data: { id: event.eventId, provider, type: event.type } });
      switch (event.type) {
        case "checkout.completed":
          return checkoutCompleted(tx, event, provider, after);
        case "invoice.paid":
          return invoicePaid(tx, event, provider, after);
        case "invoice.failed":
          return invoiceFailed(tx, event);
        case "subscription.canceled":
          return subscriptionCanceled(tx, event);
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && String(e.meta?.modelName ?? e.message).includes("ProcessedWebhookEvent")) {
      return { duplicate: true };
    }
    throw e;
  }
  for (const task of after) await task().catch((e) => console.error("payment follow-up email failed", e));
  return { duplicate: false };
}

// Links payments to a person's account (created if new, with no password or roles), so the member
// portal can show their receipts later.
async function userIdFor(tx: Tx, email: string, name?: string | null) {
  const user = await tx.user.upsert({ where: { email: email.toLowerCase() }, update: {}, create: { email: email.toLowerCase(), name: name ?? null } });
  return user.id;
}

async function recordPayment(tx: Tx, data: Omit<Prisma.PaymentUncheckedCreateInput, "receiptNumber" | "status">, after: (() => Promise<void>)[]) {
  const paidAt = (data.paidAt as Date) ?? new Date();
  const payment = await tx.payment.create({ data: { ...data, paidAt, status: "SUCCEEDED", receiptNumber: await nextReceiptNumber(tx, paidAt) } });
  after.push(async () => {
    await emailReceipt(payment);
    await db.payment.update({ where: { id: payment.id }, data: { receiptSentAt: new Date() } });
  });
  return payment;
}

async function checkoutCompleted(tx: Tx, e: Extract<PaymentEvent, { type: "checkout.completed" }>, provider: string, after: (() => Promise<void>)[]) {
  const checkout = await tx.checkoutSession.findUnique({ where: { id: e.checkoutId } });
  if (!checkout || checkout.status === "COMPLETED") return;
  await tx.checkoutSession.update({ where: { id: checkout.id }, data: { status: "COMPLETED", completedAt: e.paidAt, email: e.email, name: e.name } });
  const userId = await userIdFor(tx, e.email, e.name);

  if (e.providerSubscriptionId) {
    await tx.subscription.create({
      data: {
        provider,
        providerSubscriptionId: e.providerSubscriptionId,
        providerCustomerId: e.providerCustomerId,
        kind: checkout.kind,
        fund: checkout.fund,
        membershipId: checkout.membershipId,
        amountCents: checkout.amountCents,
        interval: checkout.frequency === "YEARLY" ? "YEAR" : "MONTH",
        currentPeriodEnd: e.currentPeriodEnd ?? new Date(e.paidAt.getTime() + 30 * 86_400_000),
        email: e.email,
        name: e.name,
        userId,
      },
    });
  }

  await recordPayment(
    tx,
    {
      kind: checkout.kind,
      fund: checkout.fund,
      frequency: checkout.frequency,
      amountCents: checkout.amountCents,
      donorName: e.name ?? checkout.name,
      donorEmail: e.email,
      userId,
      membershipId: checkout.membershipId,
      provider,
      providerCheckoutId: checkout.id,
      providerPaymentId: e.providerPaymentId,
      providerSubscriptionId: e.providerSubscriptionId,
      paidAt: e.paidAt,
    },
    after,
  );

  // First dues payment → the membership becomes active and the benefit clock starts.
  if (checkout.kind === "DUES" && checkout.membershipId) {
    const membership = await tx.membership.update({
      where: { id: checkout.membershipId },
      data: {
        status: "ACTIVE",
        enrolledAt: e.paidAt,
        benefitEligibleFrom: benefitEligibleFrom(e.paidAt, env.MASJID_TIMEZONE),
        graceEndsAt: null,
        paymentProvider: provider,
        providerCustomerId: e.providerCustomerId,
        providerSubscriptionId: e.providerSubscriptionId,
      },
      include: { household: { include: { members: true } } },
    });
    await tx.household.update({ where: { id: membership.householdId }, data: { primaryUserId: userId } });
    after.push(() => sendWelcome(membership, e.email));
  }
}

async function invoicePaid(tx: Tx, e: Extract<PaymentEvent, { type: "invoice.paid" }>, provider: string, after: (() => Promise<void>)[]) {
  const sub = await tx.subscription.findUnique({ where: { providerSubscriptionId: e.providerSubscriptionId } });
  if (!sub) return;
  await tx.subscription.update({ where: { id: sub.id }, data: { status: "ACTIVE", currentPeriodEnd: e.currentPeriodEnd } });
  await recordPayment(
    tx,
    {
      kind: sub.kind,
      fund: sub.fund,
      frequency: sub.interval === "YEAR" ? "YEARLY" : "MONTHLY",
      amountCents: sub.amountCents,
      donorName: sub.name,
      donorEmail: sub.email,
      userId: sub.userId,
      membershipId: sub.membershipId,
      provider,
      providerPaymentId: e.providerPaymentId,
      providerSubscriptionId: sub.providerSubscriptionId,
      paidAt: e.paidAt,
    },
    after,
  );
  // Dues brought current → coverage resumes (the waiting period is never reset or waived).
  if (sub.membershipId) {
    await tx.membership.update({ where: { id: sub.membershipId }, data: { status: "ACTIVE", graceEndsAt: null } });
  }
}

async function invoiceFailed(tx: Tx, e: Extract<PaymentEvent, { type: "invoice.failed" }>) {
  const sub = await tx.subscription.findUnique({ where: { providerSubscriptionId: e.providerSubscriptionId } });
  if (!sub) return;
  await tx.subscription.update({ where: { id: sub.id }, data: { status: "PAST_DUE" } });
  if (sub.membershipId) {
    const m = await tx.membership.findUnique({ where: { id: sub.membershipId } });
    // The grace period runs from the first missed due date; a second failure doesn't extend it.
    if (m && m.status !== "PAST_DUE") {
      await tx.membership.update({ where: { id: m.id }, data: { status: "PAST_DUE", graceEndsAt: graceEndsAt(e.dueAt) } });
    }
  }
}

async function subscriptionCanceled(tx: Tx, e: Extract<PaymentEvent, { type: "subscription.canceled" }>) {
  const sub = await tx.subscription.findUnique({ where: { providerSubscriptionId: e.providerSubscriptionId } });
  if (!sub) return;
  await tx.subscription.update({ where: { id: sub.id }, data: { status: "CANCELED", canceledAt: e.canceledAt } });
  if (sub.membershipId) await tx.membership.update({ where: { id: sub.membershipId }, data: { status: "CANCELLED" } });
}

async function sendWelcome(
  m: { referenceId: string; plan: "MONTHLY" | "YEARLY"; benefitEligibleFrom: Date | null; household: { members: { fullName: string }[] } },
  email: string,
) {
  const starts = m.benefitEligibleFrom ? new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "America/Los_Angeles" }).format(m.benefitEligibleFrom) : "";
  const names = m.household.members.map((x) => x.fullName);
  await sendMail({
    to: email,
    subject: `Welcome to BMCC — membership ${m.referenceId}`,
    text: `Assalamu alaikum,\n\nJazakAllah Khair for joining the Brentwood Muslim Community Center. Your membership is active.\n\nReference ID: ${m.referenceId}\nDues: ${DUES[m.plan].label}\nFuneral Services Benefit (up to ${usd(1_000_000)} per household) starts on: ${starts}\nHousehold members covered: ${names.join(", ")}\n\nA membership coordinator will confirm your details and assign your Membership ID. Your receipt is in a separate email.\n\nBrentwood Muslim Community Center`,
    html: layoutHtml(
      "Welcome to BMCC — your membership is active",
      `<p>Assalamu alaikum,</p><p>JazakAllah Khair for joining the Brentwood Muslim Community Center.</p><p><strong>Reference ID:</strong> ${m.referenceId}<br><strong>Dues:</strong> ${DUES[m.plan].label}<br><strong>Funeral Services Benefit</strong> (up to $10,000 per household) <strong>starts on ${starts}</strong></p><p><strong>Household members covered:</strong> ${names.map(escapeHtml).join(", ")}</p><p>A membership coordinator will confirm your details and assign your Membership ID. Your receipt is in a separate email.</p>`,
    ),
  });
}

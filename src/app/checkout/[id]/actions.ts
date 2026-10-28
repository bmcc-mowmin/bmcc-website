"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { isMockPayments } from "@/lib/payments/provider";
import { handlePaymentEvent } from "@/lib/payments/events";
import { safeNext } from "@/lib/security/safe-path";

// The mock checkout's buttons. Each one produces exactly the event Stripe's webhook would.
export type MockCheckoutState = { error?: string } | undefined;

const id = (prefix: string) => `${prefix}_${randomBytes(9).toString("base64url")}`;

function addInterval(from: Date, interval: "MONTHLY" | "YEARLY") {
  const d = new Date(from);
  if (interval === "YEARLY") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

async function openSession(checkoutId: string) {
  if (!isMockPayments()) throw new Error("Mock checkout is disabled.");
  const s = await db.checkoutSession.findUnique({ where: { id: checkoutId } });
  if (!s || s.provider !== "mock" || s.status !== "OPEN" || s.expiresAt < new Date()) return null;
  return s;
}

const payer = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().pipe(z.email()) });

export async function mockPay(_prev: MockCheckoutState, form: FormData): Promise<MockCheckoutState> {
  const checkoutId = String(form.get("checkoutId"));
  const session = await openSession(checkoutId);
  if (!session) return { error: "This checkout has expired or was already completed. Go back and start again." };
  const parsed = payer.safeParse({ name: form.get("name"), email: form.get("email") });
  if (!parsed.success) return { error: "Enter your name and a valid email address (your receipt is sent there)." };

  if (form.get("outcome") === "decline") {
    return { error: "Your card was declined (simulated). No payment was taken — try again or cancel." };
  }

  const paidAt = new Date();
  const recurring = session.frequency !== "ONE_TIME";
  await handlePaymentEvent(
    {
      type: "checkout.completed",
      eventId: id("mock_evt"),
      checkoutId: session.id,
      providerPaymentId: id("mock_pi"),
      providerCustomerId: id("mock_cus"),
      providerSubscriptionId: recurring ? id("mock_sub") : undefined,
      currentPeriodEnd: recurring ? addInterval(paidAt, session.frequency as "MONTHLY" | "YEARLY") : undefined,
      email: parsed.data.email,
      name: parsed.data.name,
      paidAt,
    },
    "mock",
  );
  redirect(safeNext(String(form.get("success") ?? "").replace("{CHECKOUT_ID}", session.id), "/"));
}

export async function mockCancel(form: FormData) {
  const checkoutId = String(form.get("checkoutId"));
  const session = await openSession(checkoutId);
  if (session) await db.checkoutSession.update({ where: { id: session.id }, data: { status: "CANCELED" } });
  redirect(safeNext(String(form.get("cancel") ?? "").replace("{CHECKOUT_ID}", encodeURIComponent(checkoutId)), "/"));
}

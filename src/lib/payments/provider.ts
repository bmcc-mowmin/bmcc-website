import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { CheckoutRequest, PaymentProvider } from "./types";

// PAYMENT_PROVIDER=mock (local): checkout happens on our own clearly-labelled test page,
// /checkout/<id>, and no money moves. It is refused in production by env validation.
const mock: PaymentProvider = {
  id: "mock",
  async createCheckout(req: CheckoutRequest) {
    const session = await db.checkoutSession.create({
      data: {
        provider: "mock",
        kind: req.kind,
        fund: req.fund,
        frequency: req.interval === "MONTH" ? "MONTHLY" : req.interval === "YEAR" ? "YEARLY" : "ONE_TIME",
        amountCents: req.amountCents,
        membershipId: req.membershipId,
        email: req.email,
        name: req.name,
        lang: req.lang,
        expiresAt: new Date(Date.now() + 24 * 3600_000),
        providerSessionId: `mock_cs_${randomBytes(9).toString("base64url")}`,
      },
    });
    const query = new URLSearchParams({ success: req.successUrl, cancel: req.cancelUrl });
    return { checkoutId: session.id, url: `/checkout/${session.id}?${query}` };
  },
  async cancelSubscription() {
    // Nothing to tell a provider; events.ts records the cancellation.
  },
};

// PAYMENT_PROVIDER=stripe: Stripe Checkout + Billing, connected at go-live (see GO_LIVE.md).
const stripe: PaymentProvider = {
  id: "stripe",
  async createCheckout() {
    throw new Error("The Stripe provider is connected at go-live. Use PAYMENT_PROVIDER=mock locally.");
  },
  async cancelSubscription() {
    throw new Error("The Stripe provider is connected at go-live.");
  },
};

export function paymentProvider(): PaymentProvider {
  return env.PAYMENT_PROVIDER === "stripe" ? stripe : mock;
}

export const isMockPayments = () => env.PAYMENT_PROVIDER === "mock";

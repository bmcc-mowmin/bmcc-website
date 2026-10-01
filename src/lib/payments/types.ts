// The payment-provider boundary. Everything outside src/lib/payments talks only to these types,
// so switching PAYMENT_PROVIDER from "mock" to "stripe" needs no other code changes.

export type CheckoutRequest = {
  kind: "DONATION" | "DUES";
  amountCents: number;
  interval: "MONTH" | "YEAR" | null; // null = one-time
  fund?: string;
  membershipId?: string;
  email?: string;
  name?: string;
  description: string; // shown on the checkout page / card statement
  lang: string;
  successUrl: string; // "{CHECKOUT_ID}" is replaced with our checkout id
  cancelUrl: string;
};

export interface PaymentProvider {
  id: "mock" | "stripe";
  createCheckout(req: CheckoutRequest): Promise<{ checkoutId: string; url: string }>;
  cancelSubscription(providerSubscriptionId: string): Promise<void>;
}

// Provider-neutral events. The Stripe webhook maps Stripe's events to these; the mock checkout and
// the admin "simulate" buttons produce them directly. src/lib/payments/events.ts handles them.
export type PaymentEvent =
  | {
      type: "checkout.completed";
      eventId: string;
      checkoutId: string;
      providerPaymentId: string;
      providerCustomerId?: string;
      providerSubscriptionId?: string;
      currentPeriodEnd?: Date;
      email: string;
      name?: string;
      paidAt: Date;
    }
  | { type: "invoice.paid"; eventId: string; providerSubscriptionId: string; providerPaymentId: string; paidAt: Date; currentPeriodEnd: Date }
  | { type: "invoice.failed"; eventId: string; providerSubscriptionId: string; dueAt: Date }
  | { type: "subscription.canceled"; eventId: string; providerSubscriptionId: string; canceledAt: Date };

// The payment-provider boundary. Everything outside src/lib/payments talks only to these types.
// Providers: "mock" (the site's own test checkout), "stripe" and "paypal" (hosted pages — card and
// PayPal details are entered on the provider's site, never on ours).

export type ProviderId = "mock" | "stripe" | "paypal";

export type CheckoutRequest = {
  kind: "DONATION" | "DUES";
  amountCents: number;
  interval: "MONTH" | "YEAR" | null; // null = one-time
  fund?: string;
  membershipId?: string;
  // Pre-filled on the provider's page when known (membership form, signed-in person).
  email?: string;
  name?: string;
  // The signed-in person, if any: the payment is linked to them whatever email they pay with.
  userId?: string;
  description: string; // shown on the checkout page / card statement
  lang: string;
  successUrl: string; // same-site path; "{CHECKOUT_ID}" is replaced with our checkout id
  cancelUrl: string;
};

// What a provider gets after our CheckoutSession row is created.
export type StartedCheckout = CheckoutRequest & { checkoutId: string };

export interface PaymentProvider {
  id: ProviderId;
  // Returns the address to send the person to (the provider's hosted page).
  // providerAccount: which of BMCC's Stripe accounts it was created in (Stripe only).
  createCheckout(req: StartedCheckout): Promise<{ url: string; providerSessionId: string; providerAccount?: string }>;
  cancelSubscription(providerSubscriptionId: string, providerAccount?: string | null): Promise<void>;
}

// Provider-neutral events. Webhooks and return pages map provider events to these; the mock
// checkout and the admin "simulate" buttons produce them directly. src/lib/payments/events.ts
// handles them, each eventId once.
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

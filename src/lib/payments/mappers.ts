// Pure mapping from Stripe / PayPal objects to our provider-neutral payment events.
// No network or database here, so it is unit tested (tests/unit/payments.test.ts).
import type Stripe from "stripe";
import type { PaymentEvent } from "./types";

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? undefined));
const fromUnix = (s: number) => new Date(s * 1000);

// ── Stripe ───────────────────────────────────────────────────────────────────

// A Checkout Session (retrieved with expand: ["subscription"]) → "checkout.completed", or null
// while it isn't paid (e.g. a bank payment still clearing).
export function stripeSessionEvent(s: Stripe.Checkout.Session): { checkoutId: string; event: PaymentEvent | null } {
  const checkoutId = s.client_reference_id ?? s.metadata?.checkoutId ?? "";
  if (s.status !== "complete" || s.payment_status !== "paid") return { checkoutId, event: null };
  const email = s.customer_details?.email ?? s.customer_email;
  if (!email) throw new Error(`Stripe session ${s.id} has no email`);
  const sub = typeof s.subscription === "object" && s.subscription ? s.subscription : null;
  const periodEnd = sub?.items?.data[0]?.current_period_end;
  // Subscriptions: the first invoice; one-time: the payment intent.
  const providerPaymentId = sub ? idOf(s.invoice) : idOf(s.payment_intent);
  if (!providerPaymentId) throw new Error(`Stripe session ${s.id} has no payment`);
  return {
    checkoutId,
    event: {
      type: "checkout.completed",
      // The same id from the return page and the webhook, so the second arrival is a no-op.
      eventId: `stripe_checkout_${s.id}`,
      checkoutId,
      providerPaymentId,
      providerCustomerId: idOf(s.customer),
      providerSubscriptionId: sub?.id ?? idOf(s.subscription),
      currentPeriodEnd: periodEnd ? fromUnix(periodEnd) : undefined,
      email,
      name: s.customer_details?.name ?? undefined,
      paidAt: new Date(),
    },
  };
}

// The subscription an invoice belongs to (moved under invoice.parent in recent API versions).
export const invoiceSubscriptionId = (invoice: Stripe.Invoice) => idOf(invoice.parent?.subscription_details?.subscription);

// invoice.paid / invoice.payment_failed / customer.subscription.deleted → our events (null = ignore).
export function stripeBillingEvent(event: Stripe.Event): PaymentEvent | null {
  switch (event.type) {
    case "invoice.paid": {
      const invoice = event.data.object;
      // The first invoice is recorded with the checkout itself.
      if (invoice.billing_reason === "subscription_create") return null;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (!subscriptionId || !invoice.id) return null;
      const periodEnd = invoice.lines?.data[0]?.period?.end;
      return {
        type: "invoice.paid",
        eventId: event.id,
        providerSubscriptionId: subscriptionId,
        providerPaymentId: invoice.id,
        paidAt: invoice.status_transitions?.paid_at ? fromUnix(invoice.status_transitions.paid_at) : new Date(),
        currentPeriodEnd: periodEnd ? fromUnix(periodEnd) : new Date(Date.now() + 30 * 86_400_000),
      };
    }
    case "invoice.payment_failed": {
      const subscriptionId = invoiceSubscriptionId(event.data.object);
      if (!subscriptionId) return null;
      return { type: "invoice.failed", eventId: event.id, providerSubscriptionId: subscriptionId, dueAt: fromUnix(event.data.object.created) };
    }
    case "customer.subscription.deleted":
      return { type: "subscription.canceled", eventId: event.id, providerSubscriptionId: event.data.object.id, canceledAt: new Date() };
    default:
      return null;
  }
}

// ── PayPal ───────────────────────────────────────────────────────────────────

type PayPalName = { given_name?: string; surname?: string; full_name?: string } | null | undefined;
const fullName = (n: PayPalName) => (n ? n.full_name || [n.given_name, n.surname].filter(Boolean).join(" ") || undefined : undefined);

export type PayPalCapture = { id: string; status: string; custom_id?: string; create_time?: string };
export type PayPalOrder = {
  id: string;
  status: string;
  payer?: { email_address?: string; name?: PayPalName };
  purchase_units?: { custom_id?: string; payments?: { captures?: PayPalCapture[] } }[];
};

// A captured order → "checkout.completed", or null if no capture completed.
export function paypalOrderEvent(order: PayPalOrder): { checkoutId?: string; event: PaymentEvent | null } {
  const unit = order.purchase_units?.[0];
  const capture = unit?.payments?.captures?.find((c) => c.status === "COMPLETED");
  const checkoutId = unit?.custom_id ?? capture?.custom_id;
  const email = order.payer?.email_address;
  if (!capture || !checkoutId || !email) return { checkoutId, event: null };
  return {
    checkoutId,
    event: {
      type: "checkout.completed",
      eventId: `paypal_capture_${capture.id}`,
      checkoutId,
      providerPaymentId: capture.id,
      email,
      name: fullName(order.payer?.name),
      paidAt: capture.create_time ? new Date(capture.create_time) : new Date(),
    },
  };
}

export type PayPalSubscription = {
  id: string;
  status: string; // APPROVAL_PENDING | APPROVED | ACTIVE | SUSPENDED | CANCELLED | EXPIRED
  custom_id?: string;
  subscriber?: { email_address?: string; name?: PayPalName; payer_id?: string };
  billing_info?: { next_billing_time?: string; last_payment?: { time?: string; amount?: { value: string } } };
};

// The first payment's id until PayPal tells us the sale id (renamed when PAYMENT.SALE.COMPLETED arrives).
export const firstPaymentId = (subscriptionId: string) => `${subscriptionId}:first`;

// An active subscription whose first payment went through → "checkout.completed", else null.
export function paypalSubscriptionStartEvent(sub: PayPalSubscription, saleId?: string): { checkoutId?: string; event: PaymentEvent | null } {
  const checkoutId = sub.custom_id;
  const email = sub.subscriber?.email_address;
  const paid = sub.status === "ACTIVE" && (!!saleId || !!sub.billing_info?.last_payment);
  if (!checkoutId || !email || !paid) return { checkoutId, event: null };
  return {
    checkoutId,
    event: {
      type: "checkout.completed",
      eventId: `paypal_sub_start_${sub.id}`,
      checkoutId,
      providerPaymentId: saleId ?? firstPaymentId(sub.id),
      providerCustomerId: sub.subscriber?.payer_id,
      providerSubscriptionId: sub.id,
      currentPeriodEnd: sub.billing_info?.next_billing_time ? new Date(sub.billing_info.next_billing_time) : undefined,
      email,
      name: fullName(sub.subscriber?.name),
      paidAt: sub.billing_info?.last_payment?.time ? new Date(sub.billing_info.last_payment.time) : new Date(),
    },
  };
}

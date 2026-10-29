import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";
import { stripeBillingEvent, stripeSessionEvent } from "./mappers";
import type { PaymentEvent, PaymentProvider, StartedCheckout } from "./types";

// Stripe hosted Checkout. The person enters card details on Stripe's page; we get the result from
// the return page (/api/payments/stripe/return) and Stripe's webhook (/api/webhooks/stripe).
// Prices are created inline per checkout, so nothing needs setting up in the Stripe dashboard.

let client: Stripe | null = null;
export function stripe() {
  if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(env.STRIPE_SECRET_KEY, { appInfo: { name: "bmcc-website" } });
  return client;
}

const abs = (path: string) => `${env.APP_URL}${path}`;

// Stripe Checkout languages for the site's languages (Dari/Pashto/Urdu: Stripe has none → auto).
const LOCALES: Record<string, Stripe.Checkout.SessionCreateParams.Locale> = { en: "en", spanish: "es" };

export const stripeProvider: PaymentProvider = {
  id: "stripe",
  async createCheckout(req: StartedCheckout) {
    const recurring = req.interval !== null;
    const session = await stripe().checkout.sessions.create({
      mode: recurring ? "subscription" : "payment",
      client_reference_id: req.checkoutId,
      metadata: { checkoutId: req.checkoutId, kind: req.kind },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: req.amountCents,
            product_data: { name: req.description },
            ...(recurring ? { recurring: { interval: req.interval === "YEAR" ? "year" : "month" } } : {}),
          },
        },
      ],
      ...(recurring
        ? { subscription_data: { metadata: { checkoutId: req.checkoutId, kind: req.kind, ...(req.membershipId ? { membershipId: req.membershipId } : {}) } } }
        : { submit_type: req.kind === "DONATION" ? "donate" : "pay", payment_intent_data: { metadata: { checkoutId: req.checkoutId, kind: req.kind } } }),
      ...(req.email ? { customer_email: req.email } : {}),
      locale: LOCALES[req.lang] ?? "auto",
      success_url: abs(`/api/payments/stripe/return?checkout=${encodeURIComponent(req.checkoutId)}&session_id={CHECKOUT_SESSION_ID}`),
      cancel_url: abs(`/api/payments/cancel?checkout=${encodeURIComponent(req.checkoutId)}`),
    });
    if (!session.url) throw new Error("Stripe returned no checkout URL");
    return { url: session.url, providerSessionId: session.id };
  },
  async cancelSubscription(providerSubscriptionId: string) {
    await stripe().subscriptions.cancel(providerSubscriptionId);
  },
};

// A finished Checkout Session → our "checkout.completed" event, or null while it isn't paid yet.
export async function stripeCompletion(sessionId: string): Promise<{ checkoutId: string; event: PaymentEvent | null }> {
  return stripeSessionEvent(await stripe().checkout.sessions.retrieve(sessionId, { expand: ["subscription"] }));
}

// Webhook events → our events. Returns null for events we don't act on.
export async function stripeWebhookEvent(event: Stripe.Event): Promise<PaymentEvent | null> {
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    return (await stripeCompletion(event.data.object.id)).event;
  }
  return stripeBillingEvent(event);
}

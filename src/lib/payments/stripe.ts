import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";
import { stripeBillingEvent, stripeSessionEvent } from "./mappers";
import { DEFAULT_ACCOUNT, parseStripeAccountMap, stripeAccountFor, stripeKeyVar } from "./stripe-accounts";
import type { PaymentEvent, PaymentProvider, StartedCheckout } from "./types";

// Stripe hosted Checkout. The person enters card details on Stripe's page; we get the result from
// the return page (/api/payments/stripe/return) and Stripe's webhook (/api/webhooks/stripe[/<account>]).
// Each payment goes to the Stripe account for its fund (STRIPE_ACCOUNT_MAP, stripe-accounts.ts).
// Prices are created inline per checkout, so nothing needs setting up in the Stripe dashboard.

// One client per Stripe account (STRIPE_ACCOUNT_MAP); "default" uses STRIPE_SECRET_KEY.
const clients = new Map<string, Stripe>();
export function stripe(account: string = DEFAULT_ACCOUNT) {
  const key = process.env[stripeKeyVar(account)];
  if (!key) throw new Error(`${stripeKeyVar(account)} is not set (Stripe account "${account}")`);
  let c = clients.get(account);
  if (!c) {
    c = new Stripe(key, { appInfo: { name: "bmcc-website" } });
    clients.set(account, c);
  }
  return c;
}

// The account a new payment goes to.
export function accountForPayment(kind: "DONATION" | "DUES", fund?: string | null) {
  const parsed = parseStripeAccountMap(env.STRIPE_ACCOUNT_MAP);
  return stripeAccountFor(parsed.ok ? parsed.map : {}, kind, fund);
}

const abs = (path: string) => `${env.APP_URL}${path}`;

// Stripe Checkout languages for the site's languages (Dari/Pashto/Urdu: Stripe has none → auto).
const LOCALES: Record<string, Stripe.Checkout.SessionCreateParams.Locale> = { en: "en", spanish: "es" };

export const stripeProvider: PaymentProvider = {
  id: "stripe",
  async createCheckout(req: StartedCheckout) {
    const recurring = req.interval !== null;
    const account = accountForPayment(req.kind, req.fund);
    const session = await stripe(account).checkout.sessions.create({
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
    return { url: session.url, providerSessionId: session.id, providerAccount: account };
  },
  async cancelSubscription(providerSubscriptionId: string, account?: string | null) {
    await stripe(account ?? DEFAULT_ACCOUNT).subscriptions.cancel(providerSubscriptionId);
  },
};

// A finished Checkout Session (in the given account) → our "checkout.completed" event, or null
// while it isn't paid yet.
export async function stripeCompletion(sessionId: string, account: string = DEFAULT_ACCOUNT): Promise<{ checkoutId: string; event: PaymentEvent | null }> {
  return stripeSessionEvent(await stripe(account).checkout.sessions.retrieve(sessionId, { expand: ["subscription"] }));
}

// Webhook events (from the given account's endpoint) → our events. Null for events we don't act on.
export async function stripeWebhookEvent(event: Stripe.Event, account: string = DEFAULT_ACCOUNT): Promise<PaymentEvent | null> {
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    return (await stripeCompletion(event.data.object.id, account)).event;
  }
  return stripeBillingEvent(event);
}

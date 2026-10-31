import "server-only";
import { handlePaymentEvent } from "./events";
import { stripe, stripeWebhookEvent } from "./stripe";
import { DEFAULT_ACCOUNT, stripeKeyVar, stripeWebhookVar } from "./stripe-accounts";

// Stripe → BMCC, for one Stripe account. Each account registers its own endpoint in Stripe
// (Developers → Webhooks):
//   default account:  https://<site>/api/webhooks/stripe              STRIPE_WEBHOOK_SECRET
//   account "zakah":  https://<site>/api/webhooks/stripe/zakah        STRIPE_WEBHOOK_SECRET_ZAKAH
// with events checkout.session.completed, checkout.session.async_payment_succeeded, invoice.paid,
// invoice.payment_failed, customer.subscription.deleted. A failure returns 500 so Stripe retries.
export async function handleStripeWebhook(request: Request, account: string = DEFAULT_ACCOUNT) {
  const secret = process.env[stripeWebhookVar(account)];
  if (!/^[a-z][a-z0-9_]{0,30}$/.test(account) || !secret || !process.env[stripeKeyVar(account)]) return new Response("Not configured", { status: 404 });
  const body = await request.text();
  let event;
  try {
    event = stripe(account).webhooks.constructEvent(body, request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  try {
    const mapped = await stripeWebhookEvent(event, account);
    if (mapped) await handlePaymentEvent(mapped, "stripe");
  } catch (e) {
    console.error(`Stripe webhook (${account}) ${event.type} ${event.id} failed`, e);
    return new Response("Error", { status: 500 });
  }
  return new Response("ok");
}

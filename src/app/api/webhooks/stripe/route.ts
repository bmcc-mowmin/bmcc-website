import { env } from "@/lib/env";
import { handlePaymentEvent } from "@/lib/payments/events";
import { stripe, stripeWebhookEvent } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

// Stripe → BMCC. Register https://<site>/api/webhooks/stripe in Stripe (Developers → Webhooks) for:
//   checkout.session.completed, checkout.session.async_payment_succeeded, invoice.paid,
//   invoice.payment_failed, customer.subscription.deleted
// and set STRIPE_WEBHOOK_SECRET (whsec_…). A failure returns 500 so Stripe retries.
export async function POST(request: Request) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) return new Response("Not configured", { status: 404 });
  const body = await request.text();
  let event;
  try {
    event = stripe().webhooks.constructEvent(body, request.headers.get("stripe-signature") ?? "", env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  try {
    const mapped = await stripeWebhookEvent(event);
    if (mapped) await handlePaymentEvent(mapped, "stripe");
  } catch (e) {
    console.error(`Stripe webhook ${event.type} ${event.id} failed`, e);
    return new Response("Error", { status: 500 });
  }
  return new Response("ok");
}

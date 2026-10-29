import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { handlePaymentEvent } from "./events";
import { afterCheckoutUrl } from "./provider";
import { stripeCompletion } from "./stripe";
import { getPayPalSubscription, paypalCaptureOrder } from "./paypal";
import { paypalSubscriptionStartEvent } from "./mappers";
import type { PaymentEvent } from "./types";

// What happens when the person comes back from Stripe's or PayPal's page. The payment is recorded
// here right away (the webhook may come later, or not at all on a test site without one); the
// provider event id makes the second arrival a no-op.

const redirectTo = (path: string) => new Response(null, { status: 303, headers: { Location: new URL(path, env.APP_URL).toString(), "Cache-Control": "no-store" } });

export async function completeOnReturn(checkoutId: string | null, provider: "stripe" | "paypal") {
  const session = checkoutId ? await db.checkoutSession.findUnique({ where: { id: checkoutId } }) : null;
  if (!session || session.provider !== provider || !session.providerSessionId) return redirectTo("/");
  if (session.status === "COMPLETED") return redirectTo(afterCheckoutUrl(session, "success"));

  let event: PaymentEvent | null;
  try {
    if (provider === "stripe") {
      event = (await stripeCompletion(session.providerSessionId)).event;
    } else if (session.frequency === "ONE_TIME") {
      event = (await paypalCaptureOrder(session.providerSessionId)).event;
    } else {
      event = paypalSubscriptionStartEvent(await getPayPalSubscription(session.providerSessionId)).event;
    }
  } catch (e) {
    // E.g. PayPal declined the funding source on capture. Nothing was charged; offer to try again.
    console.error(`${provider} return for checkout ${session.id} failed`, e);
    return redirectTo(afterCheckoutUrl(session, "cancel", "payment_failed=1"));
  }

  // Only accept an event for this very checkout.
  if (event && event.type === "checkout.completed" && event.checkoutId === session.id) {
    await handlePaymentEvent(event, provider);
    return redirectTo(afterCheckoutUrl(session, "success"));
  }
  // Approved but not settled yet (bank transfer clearing, PayPal activating the subscription):
  // the webhook finishes it; the page says it's being confirmed.
  return redirectTo(afterCheckoutUrl(session, "success", "pending=1"));
}

// The person left the provider's page without paying.
export async function cancelOnReturn(checkoutId: string | null) {
  const session = checkoutId ? await db.checkoutSession.findUnique({ where: { id: checkoutId } }) : null;
  if (!session) return redirectTo("/");
  if (session.status === "OPEN") await db.checkoutSession.update({ where: { id: session.id }, data: { status: "CANCELED" } });
  return redirectTo(afterCheckoutUrl(session, "cancel"));
}

import { env } from "@/lib/env";
import { verifyPayPalWebhook, type PayPalWebhookEvent } from "@/lib/payments/paypal";
import { handlePayPalWebhook } from "@/lib/payments/paypal-webhook";

export const dynamic = "force-dynamic";

// PayPal → BMCC (event list in src/lib/payments/paypal-webhook.ts). Each event is checked with
// PayPal before anything changes. A failure returns 500 so PayPal retries.
export async function POST(request: Request) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_WEBHOOK_ID) return new Response("Not configured", { status: 404 });
  let event: PayPalWebhookEvent;
  try {
    event = JSON.parse(await request.text());
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  try {
    if (!(await verifyPayPalWebhook(request.headers, event))) return new Response("Invalid signature", { status: 400 });
    await handlePayPalWebhook(event);
  } catch (e) {
    console.error(`PayPal webhook ${event.event_type} ${event.id} failed`, e);
    return new Response("Error", { status: 500 });
  }
  return new Response("ok");
}

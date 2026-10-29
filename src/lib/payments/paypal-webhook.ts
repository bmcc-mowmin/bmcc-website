import "server-only";
import { db } from "@/lib/db";
import { handlePaymentEvent } from "./events";
import { getPayPalOrder, getPayPalSubscription, type PayPalWebhookEvent } from "./paypal";
import { firstPaymentId, paypalOrderEvent, paypalSubscriptionStartEvent } from "./mappers";

// PayPal webhook events → our events. Register https://<site>/api/webhooks/paypal in the PayPal
// developer dashboard (your app → Webhooks) for:
//   PAYMENT.CAPTURE.COMPLETED, BILLING.SUBSCRIPTION.ACTIVATED, PAYMENT.SALE.COMPLETED,
//   BILLING.SUBSCRIPTION.PAYMENT.FAILED, BILLING.SUBSCRIPTION.SUSPENDED,
//   BILLING.SUBSCRIPTION.CANCELLED, BILLING.SUBSCRIPTION.EXPIRED
// and set PAYPAL_WEBHOOK_ID to that webhook's id.

const str = (v: unknown) => (typeof v === "string" ? v : undefined);

export async function handlePayPalWebhook(event: PayPalWebhookEvent) {
  const r = event.resource;
  switch (event.event_type) {
    // A one-time gift (backup for when the person never came back to our return page).
    case "PAYMENT.CAPTURE.COMPLETED": {
      const orderId = str((r.supplementary_data as { related_ids?: { order_id?: string } } | undefined)?.related_ids?.order_id);
      if (!orderId) return;
      const { event: e } = paypalOrderEvent(await getPayPalOrder(orderId));
      if (e) await handlePaymentEvent(e, "paypal");
      return;
    }

    // A subscription started (monthly gift or dues).
    case "BILLING.SUBSCRIPTION.ACTIVATED": {
      const sub = await getPayPalSubscription(str(r.id) ?? "");
      const { event: e } = paypalSubscriptionStartEvent(sub);
      if (e) await handlePaymentEvent(e, "paypal");
      return;
    }

    // Money collected on a subscription: its first payment or a renewal.
    case "PAYMENT.SALE.COMPLETED": {
      const saleId = str(r.id);
      const subscriptionId = str(r.billing_agreement_id);
      if (!saleId || !subscriptionId) return;
      // First payment already recorded from the return page under a stand-in id: give it the real one.
      const first = await db.payment.findUnique({ where: { providerPaymentId: firstPaymentId(subscriptionId) } });
      if (first) {
        await db.payment.update({ where: { id: first.id }, data: { providerPaymentId: saleId } });
        return;
      }
      if (await db.payment.findUnique({ where: { providerPaymentId: saleId } })) return;
      const sub = await getPayPalSubscription(subscriptionId);
      const known = await db.subscription.findUnique({ where: { providerSubscriptionId: subscriptionId } });
      if (!known) {
        // We haven't seen this subscription start yet: this sale is its first payment.
        const { event: e } = paypalSubscriptionStartEvent(sub, saleId);
        if (e) await handlePaymentEvent(e, "paypal");
        return;
      }
      await handlePaymentEvent(
        {
          type: "invoice.paid",
          eventId: `paypal_sale_${saleId}`,
          providerSubscriptionId: subscriptionId,
          providerPaymentId: saleId,
          paidAt: str(r.create_time) ? new Date(str(r.create_time)!) : new Date(),
          currentPeriodEnd: sub.billing_info?.next_billing_time ? new Date(sub.billing_info.next_billing_time) : new Date(Date.now() + 30 * 86_400_000),
        },
        "paypal",
      );
      return;
    }

    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
    case "BILLING.SUBSCRIPTION.SUSPENDED": {
      const subscriptionId = str(r.id);
      if (subscriptionId) await handlePaymentEvent({ type: "invoice.failed", eventId: `paypal_${event.id}`, providerSubscriptionId: subscriptionId, dueAt: new Date() }, "paypal");
      return;
    }

    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.EXPIRED": {
      const subscriptionId = str(r.id);
      if (subscriptionId) await handlePaymentEvent({ type: "subscription.canceled", eventId: `paypal_${event.id}`, providerSubscriptionId: subscriptionId, canceledAt: new Date() }, "paypal");
      return;
    }
  }
}

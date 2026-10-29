import "server-only";
import { env } from "@/lib/env";
import { paypalOrderEvent, type PayPalOrder, type PayPalSubscription } from "./mappers";
import type { PaymentEvent, PaymentProvider, StartedCheckout } from "./types";

// PayPal, by redirect: the person approves on PayPal's site and comes back to
// /api/payments/paypal/return. One-time gifts use the Orders API (captured on return);
// monthly gifts and dues use the Subscriptions API with a plan per interval (created once by
// `npm run paypal:setup`) whose price is set per subscription. Renewals, failures and
// cancellations arrive by webhook (/api/webhooks/paypal).

const BASE = () => (env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");
const abs = (path: string) => `${env.APP_URL}${path}`;

let token: { value: string; expiresAt: number } | null = null;

async function accessToken() {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set");
  const res = await fetch(`${BASE()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal sign-in failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return token.value;
}

export class PayPalError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`PayPal API error ${status}: ${body.slice(0, 500)}`);
  }
}

export async function paypalApi<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown, requestId?: string): Promise<T> {
  const res = await fetch(`${BASE()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new PayPalError(res.status, text);
  return (text ? JSON.parse(text) : {}) as T;
}

const money = (cents: number) => ({ currency_code: "USD", value: (cents / 100).toFixed(2) });
// PayPal checkout languages for the site's languages.
const LOCALES: Record<string, string> = { en: "en-US", spanish: "es-US" };

type Link = { href: string; rel: string };
const linkTo = (links: Link[] | undefined, ...rels: string[]) => links?.find((l) => rels.includes(l.rel))?.href;

export const paypalProvider: PaymentProvider = {
  id: "paypal",
  async createCheckout(req: StartedCheckout) {
    const returnUrl = abs(`/api/payments/paypal/return?checkout=${encodeURIComponent(req.checkoutId)}`);
    const cancelUrl = abs(`/api/payments/cancel?checkout=${encodeURIComponent(req.checkoutId)}`);

    if (req.interval === null) {
      const order = await paypalApi<{ id: string; links?: Link[] }>(
        "POST",
        "/v2/checkout/orders",
        {
          intent: "CAPTURE",
          purchase_units: [{ reference_id: req.checkoutId, custom_id: req.checkoutId, description: req.description.slice(0, 127), amount: money(req.amountCents) }],
          payment_source: {
            paypal: {
              ...(req.email ? { email_address: req.email } : {}),
              experience_context: {
                brand_name: "BMCC",
                shipping_preference: "NO_SHIPPING",
                user_action: "PAY_NOW",
                ...(LOCALES[req.lang] ? { locale: LOCALES[req.lang] } : {}),
                return_url: returnUrl,
                cancel_url: cancelUrl,
              },
            },
          },
        },
        `order-${req.checkoutId}`,
      );
      const url = linkTo(order.links, "payer-action", "approve");
      if (!url) throw new Error("PayPal returned no approval link");
      return { url, providerSessionId: order.id };
    }

    const planId = req.interval === "YEAR" ? env.PAYPAL_PLAN_YEARLY : env.PAYPAL_PLAN_MONTHLY;
    if (!planId) throw new Error(`PayPal plan for ${req.interval} is not set (run npm run paypal:setup)`);
    const sub = await paypalApi<{ id: string; links?: Link[] }>(
      "POST",
      "/v1/billing/subscriptions",
      {
        plan_id: planId,
        custom_id: req.checkoutId,
        // The plan's price is a placeholder; each subscription carries its own amount.
        plan: { billing_cycles: [{ sequence: 1, pricing_scheme: { fixed_price: money(req.amountCents) } }] },
        ...(req.email ? { subscriber: { email_address: req.email } } : {}),
        application_context: {
          brand_name: "BMCC",
          shipping_preference: "NO_SHIPPING",
          user_action: "SUBSCRIBE_NOW",
          ...(LOCALES[req.lang] ? { locale: LOCALES[req.lang] } : {}),
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      },
      `sub-${req.checkoutId}`,
    );
    const url = linkTo(sub.links, "approve");
    if (!url) throw new Error("PayPal returned no approval link");
    return { url, providerSessionId: sub.id };
  },
  async cancelSubscription(providerSubscriptionId: string) {
    try {
      await paypalApi("POST", `/v1/billing/subscriptions/${encodeURIComponent(providerSubscriptionId)}/cancel`, { reason: "Cancelled on the BMCC website" });
    } catch (e) {
      // Already cancelled or expired at PayPal: nothing left to stop.
      if (e instanceof PayPalError && e.status === 422) return;
      throw e;
    }
  },
};

// ── One-time gifts ───────────────────────────────────────────────────────────

// Captures an approved order (or reads it if already captured) → "checkout.completed", or null if
// the money didn't move. Same eventId from the return page and the webhook.
export async function paypalCaptureOrder(orderId: string): Promise<{ checkoutId?: string; event: PaymentEvent | null }> {
  let order: PayPalOrder;
  try {
    order = await paypalApi<PayPalOrder>("POST", `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {}, `capture-${orderId}`);
  } catch (e) {
    if (!(e instanceof PayPalError && e.status === 422 && e.body.includes("ORDER_ALREADY_CAPTURED"))) throw e;
    order = await paypalApi<PayPalOrder>("GET", `/v2/checkout/orders/${encodeURIComponent(orderId)}`);
  }
  return paypalOrderEvent(order);
}

export const getPayPalOrder = (id: string) => paypalApi<PayPalOrder>("GET", `/v2/checkout/orders/${encodeURIComponent(id)}`);

// ── Subscriptions (monthly gifts, dues) ──────────────────────────────────────

export const getPayPalSubscription = (id: string) => paypalApi<PayPalSubscription>("GET", `/v1/billing/subscriptions/${encodeURIComponent(id)}`);

// ── Webhooks ─────────────────────────────────────────────────────────────────

export type PayPalWebhookEvent = { id: string; event_type: string; resource: Record<string, unknown> & { id?: string } };

// Asks PayPal whether the webhook really came from PayPal (PAYPAL_WEBHOOK_ID is the webhook's id
// in the PayPal developer dashboard).
export async function verifyPayPalWebhook(headers: Headers, event: unknown): Promise<boolean> {
  if (!env.PAYPAL_WEBHOOK_ID) return false;
  const h = (n: string) => headers.get(n) ?? "";
  const res = await paypalApi<{ verification_status: string }>("POST", "/v1/notifications/verify-webhook-signature", {
    auth_algo: h("paypal-auth-algo"),
    cert_url: h("paypal-cert-url"),
    transmission_id: h("paypal-transmission-id"),
    transmission_sig: h("paypal-transmission-sig"),
    transmission_time: h("paypal-transmission-time"),
    webhook_id: env.PAYPAL_WEBHOOK_ID,
    webhook_event: event,
  });
  return res.verification_status === "SUCCESS";
}

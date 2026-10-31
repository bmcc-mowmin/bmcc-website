import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/security/safe-path";
import { parsePaymentMethods, paymentTypeFor, type PaymentMethod, type PaymentType } from "./methods";
import { stripeProvider } from "./stripe";
import { paypalProvider } from "./paypal";
import type { CheckoutRequest, PaymentProvider, ProviderId, StartedCheckout } from "./types";

export const isMockPayments = () => env.PAYMENT_PROVIDER === "mock";

// PAYMENT_PROVIDER=mock: the site's own clearly-labelled test page, /checkout/<id>; no money
// moves. Refused in production by env validation.
const mockProvider: PaymentProvider = {
  id: "mock",
  async createCheckout(req: StartedCheckout) {
    return { url: `/checkout/${req.checkoutId}`, providerSessionId: `mock_cs_${randomBytes(9).toString("base64url")}` };
  },
  async cancelSubscription() {
    // Nothing to tell a provider; events.ts records the cancellation.
  },
};

const PROVIDERS: Record<ProviderId, PaymentProvider> = { mock: mockProvider, stripe: stripeProvider, paypal: paypalProvider };

// The provider that owns an existing subscription or payment ("mock" | "stripe" | "paypal").
export function providerById(id: string): PaymentProvider {
  const p = PROVIDERS[id as ProviderId];
  if (!p) throw new Error(`Unknown payment provider "${id}"`);
  return p;
}

// The methods offered for a payment type, main one first.
export function methodsFor(type: PaymentType): PaymentMethod[] {
  if (isMockPayments()) return ["mock"];
  const parsed = parsePaymentMethods(env.PAYMENT_METHODS);
  return parsed.ok ? parsed.map[type] : [];
}

export class MethodNotOffered extends Error {}
// The provider couldn't start its checkout (API down, bad settings). Our checkout row exists, so
// the person can try again from it.
export class CheckoutStartFailed extends Error {
  constructor(
    public checkoutId: string,
    cause: unknown,
  ) {
    super(`Starting checkout ${checkoutId} failed`, { cause });
  }
}

// The method the person chose if it's offered for this payment type (or the only one), else null.
export function offeredMethod(type: PaymentType, method: unknown): PaymentMethod | null {
  const offered = methodsFor(type);
  if (offered.includes(method as PaymentMethod)) return method as PaymentMethod;
  return offered.length === 1 && (method === undefined || method === null || method === "") ? offered[0] : null;
}

// Keeps a return path (with its "{CHECKOUT_ID}" placeholder) only if it stays on this site.
const sameSite = (path: string) => (safeNext(path.replace("{CHECKOUT_ID}", "id"), "") ? path : "/");

// Creates our checkout record, then the provider's hosted checkout; returns where to send the
// person. `method` is the button they pressed; it must be offered for this payment type.
export async function startCheckout(req: CheckoutRequest, method: unknown): Promise<string> {
  const chosen = offeredMethod(paymentTypeFor(req.kind, req.interval !== null), method);
  if (!chosen) throw new MethodNotOffered(`Payment method "${String(method)}" is not offered for this payment`);

  const row = await db.checkoutSession.create({
    data: {
      provider: chosen,
      kind: req.kind,
      fund: req.fund,
      frequency: req.interval === "MONTH" ? "MONTHLY" : req.interval === "YEAR" ? "YEARLY" : "ONE_TIME",
      amountCents: req.amountCents,
      membershipId: req.membershipId,
      email: req.email,
      name: req.name,
      userId: req.userId,
      lang: req.lang,
      successUrl: sameSite(req.successUrl),
      cancelUrl: sameSite(req.cancelUrl),
      expiresAt: new Date(Date.now() + 24 * 3600_000),
    },
  });
  try {
    const { url, providerSessionId, providerAccount } = await providerById(chosen).createCheckout({ ...req, checkoutId: row.id });
    await db.checkoutSession.update({ where: { id: row.id }, data: { providerSessionId, providerAccount } });
    return url;
  } catch (e) {
    await db.checkoutSession.update({ where: { id: row.id }, data: { status: "CANCELED" } }).catch(() => {});
    throw new CheckoutStartFailed(row.id, e);
  }
}

// Where to send the person after a checkout: its stored success or cancel address, with our id.
export function afterCheckoutUrl(session: { id: string; successUrl: string | null; cancelUrl: string | null }, outcome: "success" | "cancel", extra?: string) {
  const path = (outcome === "success" ? session.successUrl : session.cancelUrl) ?? "/";
  const url = safeNext(path.replace("{CHECKOUT_ID}", encodeURIComponent(session.id)), "/");
  return extra ? `${url}${url.includes("?") ? "&" : "?"}${extra}` : url;
}

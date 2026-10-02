import "server-only";
import { DUES } from "@/lib/payments/catalog";
import { paymentProvider } from "@/lib/payments/provider";

// Starts the dues checkout for a membership; returns the URL to send the person to.
export async function startDuesCheckout(membershipId: string, plan: "MONTHLY" | "YEARLY", email: string, name: string, lang: string) {
  const dues = DUES[plan];
  const { url } = await paymentProvider().createCheckout({
    kind: "DUES",
    amountCents: dues.cents,
    interval: dues.interval,
    membershipId,
    email,
    name,
    description: `BMCC membership dues — ${dues.label}`,
    lang,
    successUrl: "/membership/complete?checkout={CHECKOUT_ID}",
    cancelUrl: "/membership/complete?checkout={CHECKOUT_ID}",
  });
  return url;
}

import "server-only";
import { DUES } from "@/lib/payments/catalog";
import { startCheckout } from "@/lib/payments/provider";

// Starts the dues checkout for a membership with the chosen payment method; returns the URL to
// send the person to. Throws MethodNotOffered for a method that isn't offered for dues.
export async function startDuesCheckout(
  m: { membershipId: string; plan: "MONTHLY" | "YEARLY"; email: string; name: string; lang: string; userId?: string },
  method: unknown,
) {
  const dues = DUES[m.plan];
  return startCheckout(
    {
      kind: "DUES",
      amountCents: dues.cents,
      interval: dues.interval,
      membershipId: m.membershipId,
      email: m.email,
      name: m.name,
      userId: m.userId,
      description: `BMCC membership dues — ${dues.label}`,
      lang: m.lang,
      successUrl: "/membership/complete?checkout={CHECKOUT_ID}",
      cancelUrl: "/membership/complete?checkout={CHECKOUT_ID}",
    },
    method,
  );
}

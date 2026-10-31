import { handleStripeWebhook } from "@/lib/payments/stripe-webhook";

export const dynamic = "force-dynamic";

// Stripe → BMCC for the default account (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET).
// Per-purpose accounts use /api/webhooks/stripe/<account> — see src/lib/payments/stripe-webhook.ts.
export async function POST(request: Request) {
  return handleStripeWebhook(request);
}

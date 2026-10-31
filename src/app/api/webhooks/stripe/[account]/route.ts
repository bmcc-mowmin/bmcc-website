import { handleStripeWebhook } from "@/lib/payments/stripe-webhook";

export const dynamic = "force-dynamic";

// Stripe → BMCC for one of BMCC's Stripe accounts (STRIPE_ACCOUNT_MAP), e.g. /api/webhooks/stripe/zakah
// with STRIPE_WEBHOOK_SECRET_ZAKAH. See src/lib/payments/stripe-webhook.ts.
export async function POST(request: Request, { params }: RouteContext<"/api/webhooks/stripe/[account]">) {
  const { account } = await params;
  return handleStripeWebhook(request, account.toLowerCase());
}

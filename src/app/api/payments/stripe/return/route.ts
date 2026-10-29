import { completeOnReturn } from "@/lib/payments/returns";

export const dynamic = "force-dynamic";

// Stripe Checkout's success_url.
export async function GET(request: Request) {
  return completeOnReturn(new URL(request.url).searchParams.get("checkout"), "stripe");
}

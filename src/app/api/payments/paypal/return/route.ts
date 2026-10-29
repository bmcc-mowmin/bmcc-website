import { completeOnReturn } from "@/lib/payments/returns";

export const dynamic = "force-dynamic";

// PayPal's return_url after the person approves an order or a subscription.
export async function GET(request: Request) {
  return completeOnReturn(new URL(request.url).searchParams.get("checkout"), "paypal");
}

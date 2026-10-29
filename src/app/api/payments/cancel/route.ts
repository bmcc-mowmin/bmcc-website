import { cancelOnReturn } from "@/lib/payments/returns";

export const dynamic = "force-dynamic";

// cancel_url for Stripe and PayPal: back to the page the payment started from.
export async function GET(request: Request) {
  return cancelOnReturn(new URL(request.url).searchParams.get("checkout"));
}

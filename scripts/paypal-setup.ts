// One-time PayPal setup for monthly gifts and dues: creates a product and two subscription plans
// (monthly, yearly) in the PayPal account, and prints the settings to add:
//
//   PAYPAL_ENV=sandbox PAYPAL_CLIENT_ID=… PAYPAL_CLIENT_SECRET=… npm run paypal:setup
//
// Run it once per PayPal account (sandbox, then live). The plans' $1 price is a placeholder: each
// subscription sets its own amount. Re-running creates new plans; use the latest printed ids.
import "dotenv/config";

const env = process.env.PAYPAL_ENV === "live" ? "live" : "sandbox";
const base = env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
const id = process.env.PAYPAL_CLIENT_ID;
const secret = process.env.PAYPAL_CLIENT_SECRET;
if (!id || !secret) {
  console.error("Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET (and PAYPAL_ENV=live for the live account).");
  process.exit(1);
}

async function call<T>(method: string, path: string, token: string, body: unknown): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return JSON.parse(text) as T;
}

async function main() {
  const auth = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!auth.ok) throw new Error(`PayPal sign-in failed (${auth.status}): ${await auth.text()}`);
  const { access_token: token } = (await auth.json()) as { access_token: string };

  const product = await call<{ id: string }>("POST", "/v1/catalogs/products", token, {
    name: "BMCC recurring gifts and membership dues",
    description: "Brentwood Muslim Community Center",
    type: "SERVICE",
    category: "CHARITY",
  });

  const plan = (name: string, unit: "MONTH" | "YEAR") =>
    call<{ id: string; status: string }>("POST", "/v1/billing/plans", token, {
      product_id: product.id,
      name,
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: { interval_unit: unit, interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0, // until cancelled
          pricing_scheme: { fixed_price: { value: "1.00", currency_code: "USD" } },
        },
      ],
      payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 3 },
    });

  const monthly = await plan("BMCC monthly", "MONTH");
  const yearly = await plan("BMCC yearly", "YEAR");

  console.log(`PayPal ${env}: product ${product.id}, plans created (${monthly.status}, ${yearly.status}). Add these settings:\n`);
  console.log(`PAYPAL_PLAN_MONTHLY=${monthly.id}`);
  console.log(`PAYPAL_PLAN_YEARLY=${yearly.id}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

// Which Stripe account takes which payment. BMCC keeps separate Stripe accounts per purpose
// (operations, zakah, construction, …); the setting maps membership dues and each donation fund to
// an account name:
//
//   STRIPE_ACCOUNT_MAP="dues:operations;masjid-membership:operations;sadaqah-zakat:zakah;
//                       zakat-fitr:zakah;new-bmcc:construction;construct-run:building"
//
// Each account name has its own secret key and webhook secret:
//   STRIPE_SECRET_KEY_OPERATIONS, STRIPE_WEBHOOK_SECRET_OPERATIONS, …
// Anything not mapped (or everything, when the setting is empty) uses the "default" account:
// STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET. "default" may also be used as a key in the map.
// (Pure — no secrets or network here; unit tested.)
import { FUNDS } from "./catalog";

export const DEFAULT_ACCOUNT = "default";
const ACCOUNT_NAME = /^[a-z][a-z0-9_]{0,30}$/;
const KEYS = ["dues", "default", ...FUNDS.map((f) => f.id)];

export type StripeAccountMap = Record<string, string>;

export function parseStripeAccountMap(raw: string | undefined): { ok: true; map: StripeAccountMap } | { ok: false; errors: string[] } {
  const map: StripeAccountMap = {};
  const errors: string[] = [];
  for (const part of (raw ?? "").split(";").map((s) => s.trim()).filter(Boolean)) {
    const [key = "", account = ""] = part.split(":").map((s) => s.trim().toLowerCase());
    if (!KEYS.includes(key)) errors.push(`unknown payment "${key}" (use dues, default or a fund: ${FUNDS.map((f) => f.id).join(", ")})`);
    else if (!ACCOUNT_NAME.test(account)) errors.push(`bad account name "${account}" for ${key} (letters, digits, _)`);
    else map[key] = account;
  }
  return errors.length ? { ok: false, errors } : { ok: true, map };
}

// The account for a payment: dues → map.dues; a donation → its fund; else map.default; else "default".
export function stripeAccountFor(map: StripeAccountMap, kind: "DONATION" | "DUES", fund?: string | null): string {
  const key = kind === "DUES" ? "dues" : (fund ?? "");
  return map[key] ?? map[DEFAULT_ACCOUNT] ?? DEFAULT_ACCOUNT;
}

// Every account that some payment can reach (so each needs a key).
export function accountsInUse(map: StripeAccountMap): string[] {
  return [...new Set(["dues", ...FUNDS.map((f) => f.id)].map((k) => stripeAccountFor(map, k === "dues" ? "DUES" : "DONATION", k)))];
}

// Environment variable names for an account's secrets.
export const stripeKeyVar = (account: string) => (account === DEFAULT_ACCOUNT ? "STRIPE_SECRET_KEY" : `STRIPE_SECRET_KEY_${account.toUpperCase()}`);
export const stripeWebhookVar = (account: string) => (account === DEFAULT_ACCOUNT ? "STRIPE_WEBHOOK_SECRET" : `STRIPE_WEBHOOK_SECRET_${account.toUpperCase()}`);

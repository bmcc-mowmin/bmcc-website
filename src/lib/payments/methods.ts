// Which payment methods are offered for each kind of payment.
//
// The setting maps a payment type to the providers offered for it, e.g.
//   PAYMENT_METHODS="donation:stripe,paypal;donation_monthly:stripe;dues:stripe,paypal"
// The person picks one with a button on the Donate or Membership page. Order matters: the first
// method is the main button. With PAYMENT_PROVIDER=mock every type uses the test checkout instead.
// (Shared by the browser and the server; no secrets here.)

export const PAYMENT_TYPES = ["donation", "donation_monthly", "dues"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const LIVE_METHODS = ["stripe", "paypal"] as const;
export type LiveMethod = (typeof LIVE_METHODS)[number];
export type PaymentMethod = LiveMethod | "mock";

export type MethodMap = Record<PaymentType, LiveMethod[]>;

export const DEFAULT_PAYMENT_METHODS = "donation:stripe;donation_monthly:stripe;dues:stripe";

// The payment type behind what the person chose on the page.
export function paymentTypeFor(kind: "DONATION" | "DUES", recurring: boolean): PaymentType {
  if (kind === "DUES") return "dues";
  return recurring ? "donation_monthly" : "donation";
}

// Parses the setting. Returns the map, or a list of problems (unknown type or method, a type with
// no methods, a type missing from the setting).
export function parsePaymentMethods(raw: string): { ok: true; map: MethodMap } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const map: Partial<MethodMap> = {};
  for (const part of raw.split(";").map((s) => s.trim()).filter(Boolean)) {
    const [typeRaw, methodsRaw = ""] = part.split(":").map((s) => s.trim().toLowerCase());
    if (!(PAYMENT_TYPES as readonly string[]).includes(typeRaw)) {
      errors.push(`unknown payment type "${typeRaw}" (use ${PAYMENT_TYPES.join(", ")})`);
      continue;
    }
    const methods = [...new Set(methodsRaw.split(",").map((s) => s.trim()).filter(Boolean))];
    const unknown = methods.filter((m) => !(LIVE_METHODS as readonly string[]).includes(m));
    if (unknown.length) errors.push(`unknown payment method "${unknown.join(", ")}" for ${typeRaw} (use ${LIVE_METHODS.join(", ")})`);
    if (!methods.length) errors.push(`no payment method for ${typeRaw}`);
    map[typeRaw as PaymentType] = methods.filter((m): m is LiveMethod => (LIVE_METHODS as readonly string[]).includes(m));
  }
  for (const t of PAYMENT_TYPES) if (!map[t]) errors.push(`missing payment type ${t}`);
  return errors.length ? { ok: false, errors } : { ok: true, map: map as MethodMap };
}

export const methodsInUse = (map: MethodMap) => new Set(PAYMENT_TYPES.flatMap((t) => map[t]));

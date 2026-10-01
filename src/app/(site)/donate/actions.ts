"use server";

import { redirect } from "next/navigation";
import { getLang } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionary";
import { checkHoneypot } from "@/lib/security/honeypot";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/request";
import { paymentProvider } from "@/lib/payments/provider";
import { FUND_LABELS, isFund, MAX_DONATION, MIN_DONATION, usd } from "@/lib/payments/catalog";

export type DonateState = { error?: string } | undefined;

export async function startDonation(_prev: DonateState, form: FormData): Promise<DonateState> {
  const lang = await getLang();
  const t = getDictionary(lang);
  if (checkHoneypot(form).spam) redirect("/donate");
  if (!(await rateLimit(`donate:${await clientIp()}`, { max: 20, windowSec: 600 }))) return { error: t.form_rate_limited };

  const fund = String(form.get("fund") ?? "");
  const monthly = form.get("frequency") === "monthly";
  const dollars = Number(String(form.get("amount") ?? "").replace(/[$,\s]/g, ""));
  if (!isFund(fund)) return { error: t.form_error_generic };
  if (!Number.isFinite(dollars) || dollars < MIN_DONATION) return { error: t.donate_min_error };
  if (dollars > MAX_DONATION) return { error: t.donate_max_error };
  const amountCents = Math.round(dollars * 100);

  const { url } = await paymentProvider().createCheckout({
    kind: "DONATION",
    amountCents,
    interval: monthly ? "MONTH" : null,
    fund,
    description: `${monthly ? "Monthly donation" : "Donation"} — ${FUND_LABELS[fund]} (${usd(amountCents)}${monthly ? "/month" : ""})`,
    lang,
    successUrl: "/donate/thank-you?checkout={CHECKOUT_ID}",
    cancelUrl: `/donate?canceled=1&fund=${fund}`,
  });
  redirect(url);
}

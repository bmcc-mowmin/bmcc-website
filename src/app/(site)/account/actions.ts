"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminUrl, env } from "@/lib/env";
import { requireMember } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getMyHousehold, getMyMemberships, getMyRecurringGifts } from "@/lib/account";
import { getLang } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionary";
import { fieldErrors } from "@/lib/directory/listing";
import { startDuesCheckout } from "@/lib/membership/checkout";
import { paymentProvider } from "@/lib/payments/provider";
import { handlePaymentEvent } from "@/lib/payments/events";
import { rateLimit } from "@/lib/security/rate-limit";
import { escapeHtml, layoutHtml, sendMail } from "@/lib/mail";

export type FormState = { status: "idle" } | { status: "done"; message: string } | { status: "error"; message: string; errors: Record<string, string>; values: Record<string, string> };

// Pay dues for an application that was never paid.
export async function payPendingDues(form: FormData) {
  const user = await requireMember("/account");
  const membership = (await getMyMemberships(user)).find((m) => m.id === form.get("membershipId") && m.status === "PENDING_PAYMENT");
  if (!membership) redirect("/account");
  const self = membership.household.members.find((p) => p.relationship === "SELF");
  redirect(await startDuesCheckout(membership.id, membership.plan, membership.household.email, self?.fullName ?? user.name ?? "", await getLang()));
}

// Stop a monthly donation. (Membership dues are changed with the office: the benefit depends on them.)
export async function cancelMonthlyGift(form: FormData) {
  const user = await requireMember("/account/giving");
  const gift = (await getMyRecurringGifts(user)).find((s) => s.id === form.get("subscriptionId"));
  if (!gift) redirect("/account/giving");
  await paymentProvider().cancelSubscription(gift.providerSubscriptionId);
  // With Stripe the webhook reports the same cancellation; handling it twice changes nothing.
  await handlePaymentEvent({ type: "subscription.canceled", eventId: `member_cancel_${gift.id}`, providerSubscriptionId: gift.providerSubscriptionId, canceledAt: new Date() }, gift.provider);
  await audit(user.id, "cancel_recurring_gift", "Subscription", gift.id);
  revalidatePath("/account/giving");
  redirect("/account/giving?canceled=1");
}

const phone = z
  .string()
  .trim()
  .max(40)
  .refine((v) => (v.replace(/\D/g, "").length >= 7 && v.replace(/\D/g, "").length <= 15), "form_error_phone");
const contactSchema = z.object({
  addressLine1: z.string().trim().min(1, "form_error_required").max(200),
  addressLine2: z.string().trim().max(200),
  city: z.string().trim().min(1, "form_error_required").max(80),
  state: z.string().trim().min(1, "form_error_required").max(40),
  zip: z.string().trim().min(1, "form_error_required").max(12),
  phone,
  emergencyName: z.string().trim().max(120),
  emergencyPhone: z.union([z.literal(""), phone]),
});

export async function updateHouseholdContact(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireMember("/account/household");
  const t = getDictionary(await getLang());
  const values = Object.fromEntries(Object.keys(contactSchema.shape).map((k) => [k, String(form.get(k) ?? "")]));
  const mine = await getMyHousehold(user);
  if (!mine) redirect("/account");
  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) return { status: "error", message: t.form_error_generic, errors: fieldErrors(parsed.error), values };
  const data = { ...parsed.data, addressLine2: parsed.data.addressLine2 || null };
  await db.household.update({ where: { id: mine.household.id }, data });
  await audit(user.id, "member_update_contact", "Household", mine.household.id, data);
  revalidatePath("/account", "layout");
  return { status: "done", message: t.acct_saved };
}

// Adding or removing covered people affects the Funeral Services Benefit, so the office makes
// that change (Admin → Memberships). This sends them the request.
export async function requestCoverageChange(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireMember("/account/household");
  const t = getDictionary(await getLang());
  const message = String(form.get("message") ?? "").trim();
  const values = { message };
  if (!message) return { status: "error", message: t.form_error_generic, errors: { message: "form_error_required" }, values };
  if (message.length > 3000) return { status: "error", message: t.form_error_generic, errors: { message: "form_error_required" }, values };
  if (!(await rateLimit(`coverage-request:${user.id}`, { max: 5, windowSec: 86_400 }))) return { status: "error", message: t.form_rate_limited, errors: {}, values };
  const mine = await getMyHousehold(user);
  if (!mine) redirect("/account");

  const name = mine.household.members.find((p) => p.relationship === "SELF")?.fullName ?? user.name ?? user.email;
  const saved = await db.contactMessage.create({ data: { name, email: user.email, message, topic: "household" } });
  const link = adminUrl(`/admin/memberships/${mine.membership.id}`);
  await sendMail({
    to: env.CONTACT_INBOX,
    replyTo: user.email,
    subject: `[Member] Change to covered people — ${mine.membership.referenceId}`,
    text: `${name} <${user.email}> asked to change the people covered by membership ${mine.membership.referenceId}:\n\n${message}\n\nMake the change in Admin → Memberships: ${link}\nThe request is also in Admin → Messages.`,
    html: layoutHtml(
      "Request: change covered people",
      `<p><strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(user.email)}&gt; asked to change the people covered by membership <strong>${escapeHtml(mine.membership.referenceId)}</strong>:</p><p style="white-space:pre-line;border-inline-start:3px solid #d7e4fb;padding-inline-start:12px">${escapeHtml(message)}</p><p><a href="${link}">Open the membership in admin</a></p>`,
    ),
  }).catch((e) => console.error("coverage request email failed", e));
  await audit(user.id, "member_request_coverage_change", "ContactMessage", saved.id);
  return { status: "done", message: t.acct_request_sent };
}

"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getLang } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionary";
import { checkHoneypot } from "@/lib/security/honeypot";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/request";
import { paymentProvider } from "@/lib/payments/provider";
import { DUES } from "@/lib/payments/catalog";

export type MembershipState = { errors: Record<string, string>; values: Record<string, string>; message?: string } | undefined;

const RELATIONSHIPS = ["SPOUSE", "CHILD", "PARENT", "SIBLING", "OTHER"] as const;
const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => text(max).min(1, "form_error_required");
const optionalText = (max: number) => text(max).optional().transform((v) => v || null);
const phone = z
  .string()
  .trim()
  .max(40)
  .refine((v) => {
    const d = v.replace(/\D/g, "");
    return d.length >= 7 && d.length <= 15;
  }, "form_error_phone");
const optionalPhone = z
  .string()
  .trim()
  .max(40)
  .optional()
  .refine((v) => !v || (v.replace(/\D/g, "").length >= 7 && v.replace(/\D/g, "").length <= 15), "form_error_phone")
  .transform((v) => v || null);
// A real past date, not before 1900.
const dob = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "m_error_dob")
  .refine((v) => v >= "1900-01-01" && new Date(`${v}T12:00:00Z`) <= new Date(), "m_error_dob");
const email = z.string().trim().toLowerCase().max(200).pipe(z.email({ message: "form_error_email" }));

const primarySchema = z.object({
  fullName: required(120),
  street: required(200),
  city: required(80),
  state: required(40),
  zip: required(12),
  dob,
  phone,
  email,
  emergencyName: optionalText(120),
  emergencyPhone: optionalPhone,
  plan: z.enum(["MONTHLY", "YEARLY"]),
  declaration: z.literal("on", { message: "m_error_declaration" }),
});

const dependentSchema = z.object({
  name: required(120),
  relationship: z.enum(RELATIONSHIPS, { message: "form_error_required" }),
  dob: z.string().optional().transform((v) => v || null).pipe(dob.nullable()),
  phone: optionalPhone,
  email: z.string().trim().toLowerCase().max(200).optional().transform((v) => v || null).pipe(z.email({ message: "form_error_email" }).nullable()),
});

async function referenceId() {
  for (;;) {
    const ref = `BMCC-${new Date().getFullYear()}-${randomBytes(4).toString("hex").toUpperCase().slice(0, 6)}`;
    if (!(await db.membership.findUnique({ where: { referenceId: ref } }))) return ref;
  }
}

async function startDuesCheckout(membershipId: string, plan: "MONTHLY" | "YEARLY", email: string, name: string, lang: string) {
  const dues = DUES[plan];
  const { url } = await paymentProvider().createCheckout({
    kind: "DUES",
    amountCents: dues.cents,
    interval: dues.interval,
    membershipId,
    email,
    name,
    description: `BMCC membership dues — ${dues.label}`,
    lang,
    successUrl: "/membership/complete?checkout={CHECKOUT_ID}",
    cancelUrl: "/membership/complete?checkout={CHECKOUT_ID}",
  });
  return url;
}

export async function applyForMembership(_prev: MembershipState, form: FormData): Promise<MembershipState> {
  const lang = await getLang();
  const t = getDictionary(lang);
  const values = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  if (checkHoneypot(form).spam) redirect("/membership");
  if (!(await rateLimit(`membership:${await clientIp()}`))) return { errors: {}, values, message: t.form_rate_limited };

  const errors: Record<string, string> = {};
  const primary = primarySchema.safeParse(values);
  if (!primary.success) for (const i of primary.error.issues) errors[String(i.path[0])] ??= i.message;

  // Household rows: dep.<n>.name / relationship / dob / phone / email. Fully empty rows are ignored.
  const rowIds = [...new Set(Object.keys(values).filter((k) => k.startsWith("dep.")).map((k) => k.split(".")[1]))];
  const dependents: z.output<typeof dependentSchema>[] = [];
  for (const id of rowIds) {
    const row = { name: values[`dep.${id}.name`], relationship: values[`dep.${id}.relationship`], dob: values[`dep.${id}.dob`], phone: values[`dep.${id}.phone`], email: values[`dep.${id}.email`] };
    if (!Object.values(row).some((v) => v && v.trim())) continue;
    const parsed = dependentSchema.safeParse(row);
    if (parsed.success) dependents.push(parsed.data);
    else for (const i of parsed.error.issues) errors[`dep.${id}.${String(i.path[0])}`] ??= i.message;
  }

  if (!primary.success || Object.keys(errors).length) {
    return { errors, values, message: t.form_error_generic };
  }
  const p = primary.data;

  const membership = await db.$transaction(async (tx) => {
    const household = await tx.household.create({
      data: {
        addressLine1: p.street,
        city: p.city,
        state: p.state,
        zip: p.zip,
        phone: p.phone,
        email: p.email,
        emergencyName: p.emergencyName ?? "",
        emergencyPhone: p.emergencyPhone ?? "",
        members: {
          create: [
            { fullName: p.fullName, relationship: "SELF", dateOfBirth: new Date(`${p.dob}T00:00:00Z`), phone: p.phone, email: p.email },
            ...dependents.map((d) => ({
              fullName: d.name,
              relationship: d.relationship,
              dateOfBirth: d.dob ? new Date(`${d.dob}T00:00:00Z`) : null,
              phone: d.phone,
              email: d.email,
            })),
          ],
        },
      },
    });
    return tx.membership.create({
      data: { referenceId: await referenceId(), householdId: household.id, plan: p.plan, status: "PENDING_PAYMENT", declarationAcceptedAt: new Date() },
    });
  });

  redirect(await startDuesCheckout(membership.id, p.plan, p.email, p.fullName, lang));
}

// "Complete payment" for an application whose checkout was canceled.
export async function resumeDuesPayment(form: FormData) {
  const lang = await getLang();
  const old = await db.checkoutSession.findUnique({
    where: { id: String(form.get("checkoutId")) },
    include: { membership: { include: { household: { include: { members: { where: { relationship: "SELF" } } } } } } },
  });
  const m = old?.membership;
  if (!m || m.status !== "PENDING_PAYMENT") redirect("/membership");
  redirect(await startDuesCheckout(m.id, m.plan, m.household.email, m.household.members[0]?.fullName ?? "", lang));
}

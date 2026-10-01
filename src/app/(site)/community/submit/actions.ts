"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { adminUrl, env } from "@/lib/env";
import { getLang } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionary";
import { checkHoneypot } from "@/lib/security/honeypot";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/request";
import { fieldErrors, listingSchema } from "@/lib/directory/listing";
import { buttonHtml, escapeHtml, layoutHtml, sendMail } from "@/lib/mail";

export type SubmitState =
  | { status: "idle" }
  | { status: "done" }
  | { status: "error"; message: string; errors: Record<string, string>; values: Record<string, string> };

const extra = z.object({
  submitterEmail: z.string().trim().max(200).pipe(z.email({ message: "form_error_email" })),
  consent: z.literal("on", { message: "form_error_consent" }),
});

export async function submitListing(_prev: SubmitState, form: FormData): Promise<SubmitState> {
  const t = getDictionary(await getLang());
  const values = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

  // Bots get a normal-looking success so they don't learn what was caught.
  if (checkHoneypot(form).spam) return { status: "done" };
  if (!(await rateLimit(`directory-submit:${await clientIp()}`))) {
    return { status: "error", message: t.form_rate_limited, errors: {}, values };
  }

  const parentCategory = values.parentCategory === "__other" ? values.parentCategoryNew : values.parentCategory;
  const parsed = listingSchema.safeParse({ ...values, parentCategory });
  const parsedExtra = extra.safeParse(values);
  if (!parsed.success || !parsedExtra.success) {
    const errors = { ...(parsed.success ? {} : fieldErrors(parsed.error)), ...(parsedExtra.success ? {} : fieldErrors(parsedExtra.error)) };
    if (errors.parentCategory && values.parentCategory === "__other") errors.parentCategoryNew = errors.parentCategory;
    return { status: "error", message: t.form_error_generic, errors, values };
  }

  const listing = await db.directoryListing.create({
    data: { ...parsed.data, submitterEmail: parsedExtra.data.submitterEmail.toLowerCase(), status: "PENDING" },
  });

  // Notifications must never make the submission fail.
  const queue = adminUrl("/admin/directory");
  await Promise.allSettled([
    sendMail({
      to: env.CONTACT_INBOX,
      subject: `New directory listing to review: ${listing.name}`,
      text: `A new Community Directory listing is waiting for approval.\n\n${listing.name} — ${listing.parentCategory} / ${listing.category}\nSubmitted by ${listing.submitterEmail}\n\nReview it: ${queue}`,
      html: layoutHtml(
        "New directory listing to review",
        `<p><strong>${escapeHtml(listing.name)}</strong><br>${escapeHtml(listing.parentCategory)} / ${escapeHtml(listing.category)}<br>Submitted by ${escapeHtml(listing.submitterEmail ?? "")}</p>${buttonHtml(queue, "Open the approval queue")}`,
      ),
    }),
    sendMail({
      to: parsedExtra.data.submitterEmail,
      subject: "We received your Community Directory listing",
      text: `Thank you for submitting "${listing.name}" to the BMCC Community Directory.\n\nOur admin team reviews every listing before it goes live. We'll email you when it has been reviewed.\n\nBrentwood Muslim Community Center`,
      html: layoutHtml(
        "We received your listing",
        `<p>Thank you for submitting <strong>${escapeHtml(listing.name)}</strong> to the BMCC Community Directory.</p><p>Our admin team reviews every listing before it goes live. We'll email you when it has been reviewed.</p>`,
      ),
    }),
  ]).then((results) => results.forEach((r) => r.status === "rejected" && console.error("directory email failed", r.reason)));

  return { status: "done" };
}


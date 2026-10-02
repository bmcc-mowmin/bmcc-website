"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { adminUrl } from "@/lib/env";
import { getLang } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { getDictionary } from "@/lib/i18n/dictionary";
import { checkHoneypot } from "@/lib/security/honeypot";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/request";
import { fieldErrors } from "@/lib/directory/listing";
import { CONTACT_TOPICS, isContactTopic } from "@/lib/contact/topics";
import { escapeHtml, layoutHtml, sendMail } from "@/lib/mail";

export type ContactState =
  | { status: "idle" }
  | { status: "done" }
  | { status: "error"; message: string; errors: Record<string, string>; values: Record<string, string> };

const schema = z.object({
  name: z.string().trim().min(1, "form_error_required").max(120),
  email: z.string().trim().max(200).pipe(z.email({ message: "form_error_email" })),
  message: z.string().trim().min(1, "form_error_required").max(5000),
});

// Header-safe single line (names end up in the email subject).
const oneLine = (s: string) => s.replace(/[\r\n\t]+/g, " ").slice(0, 120);

export async function sendContactMessage(_prev: ContactState, form: FormData): Promise<ContactState> {
  const lang = await getLang();
  const t = getDictionary(lang);
  const values = { name: String(form.get("name") ?? ""), email: String(form.get("email") ?? ""), message: String(form.get("message") ?? ""), topic: String(form.get("topic") ?? "") };

  const spam = checkHoneypot(form);
  if (spam.reason === "honeypot") return { status: "done" };
  if (spam.reason === "too_fast") return { status: "error", message: t.form_try_again, errors: {}, values };
  if (!(await rateLimit(`contact:${await clientIp()}`))) return { status: "error", message: t.form_rate_limited, errors: {}, values };

  const parsed = schema.safeParse(values);
  if (!parsed.success) return { status: "error", message: t.form_error_generic, errors: fieldErrors(parsed.error), values };
  const { name, email, message } = parsed.data;
  const topic = isContactTopic(values.topic) ? values.topic : null;

  const saved = await db.contactMessage.create({ data: { name, email: email.toLowerCase(), message, topic } });

  // The message is saved; email problems must not make the form fail.
  const about = topic ? getDictionary("en")[CONTACT_TOPICS[topic]] : "General question";
  const inbox = adminUrl(`/admin/messages/${saved.id}`);
  await Promise.allSettled([
    sendMail({
      to: (await getSettings()).contactInbox,
      replyTo: email,
      subject: `[Website] ${about} — ${oneLine(name)}`,
      text: `New message from the website contact form.\n\nFrom: ${name} <${email}>\nAbout: ${about}\n\n${message}\n\nReply to this email to answer them, then mark it handled: ${inbox}`,
      html: layoutHtml(
        "New message from the website",
        `<p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;<br><strong>About:</strong> ${escapeHtml(about)}</p><p style="white-space:pre-line;border-inline-start:3px solid #d7e4fb;padding-inline-start:12px">${escapeHtml(message)}</p><p style="color:#6b7280;font-size:13px">Reply to this email to answer them, then <a href="${inbox}">mark it handled</a>.</p>`,
      ),
    }),
    // A short acknowledgement that does not repeat what was written, so the form can't be used to
    // send someone else arbitrary text.
    sendMail({
      to: email,
      subject: t.contact_ack_subject,
      text: `${t.contact_ack_body}\n\nBrentwood Muslim Community Center`,
      html: layoutHtml(t.contact_ack_subject, `<p>${escapeHtml(t.contact_ack_body)}</p>`),
    }),
  ]).then((results) => results.forEach((r) => r.status === "rejected" && console.error("contact email failed", r.reason)));

  return { status: "done" };
}

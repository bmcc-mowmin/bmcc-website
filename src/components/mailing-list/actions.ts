"use server";

import { z } from "zod";
import { getLang } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionary";
import { checkHoneypot } from "@/lib/security/honeypot";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/request";
import { requestSubscription, SOURCES } from "@/lib/mailing-list";

export type SubscribeState = { status: "idle" } | { status: "done" } | { status: "error"; message: string; email: string };

const schema = z.object({
  email: z.string().trim().max(200).pipe(z.email()),
  source: z.enum(SOURCES),
});

// Shared by the re-subscribe bar and the "Stay Connected" form.
export async function subscribe(_prev: SubscribeState, form: FormData): Promise<SubscribeState> {
  const lang = await getLang();
  const t = getDictionary(lang);
  const email = String(form.get("email") ?? "");

  const spam = checkHoneypot(form);
  // A filled honeypot gets a normal-looking success; a too-quick press (e.g. autofill right after
  // the page loads) just asks the person to press again.
  if (spam.reason === "honeypot") return { status: "done" };
  if (spam.reason === "too_fast") return { status: "error", message: t.form_try_again, email };
  if (!(await rateLimit(`subscribe:${await clientIp()}`))) return { status: "error", message: t.form_rate_limited, email };

  const parsed = schema.safeParse({ email, source: form.get("source") });
  if (!parsed.success) return { status: "error", message: t.form_error_email, email };

  try {
    await requestSubscription({ ...parsed.data, lang });
  } catch (e) {
    console.error("subscription request failed", e);
    return { status: "error", message: t.form_failed, email };
  }
  return { status: "done" };
}

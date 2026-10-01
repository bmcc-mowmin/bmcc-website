"use server";

import { redirect } from "next/navigation";
import { confirmSubscription } from "@/lib/mailing-list";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/request";

export async function confirmAction(form: FormData) {
  const ip = await clientIp();
  if (!(await rateLimit(`subscribe-confirm:${ip}`))) redirect("/subscribe/confirm?status=invalid");
  const ok = await confirmSubscription(String(form.get("token") ?? ""), ip === "unknown" ? null : ip);
  redirect(`/subscribe/confirm?status=${ok ? "done" : "invalid"}`);
}

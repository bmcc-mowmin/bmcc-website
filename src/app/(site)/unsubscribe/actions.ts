"use server";

import { redirect } from "next/navigation";
import { unsubscribe } from "@/lib/mailing-list";

export async function unsubscribeAction(form: FormData) {
  const row = await unsubscribe(String(form.get("token") ?? ""));
  redirect(row ? "/unsubscribe?status=done" : "/unsubscribe");
}

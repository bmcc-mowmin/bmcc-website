"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { done, fail, text } from "@/lib/admin/forms";
import type { ActionResult } from "@/components/admin/ActionForm";

// Stops all list email to the address (e.g. someone asked the office by phone).
export async function unsubscribeSubscriber(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireSection("subscribers");
  const row = await db.subscriber.findUnique({ where: { id: text(form, "id") } });
  if (!row) return fail("Subscriber not found.");
  await db.subscriber.update({ where: { id: row.id }, data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date(), confirmTokenHash: null, tokenExpiresAt: null } });
  await audit(user.id, "unsubscribe", "Subscriber", row.id, { email: row.email });
  revalidatePath("/admin/subscribers");
  return done("Unsubscribed.");
}

// Erases the address completely (a request to delete someone's data).
export async function deleteSubscriber(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireSection("subscribers");
  const row = await db.subscriber.findUnique({ where: { id: text(form, "id") } });
  if (!row) return fail("Subscriber not found.");
  await db.subscriber.delete({ where: { id: row.id } });
  // The log keeps that a deletion happened, not the address.
  await audit(user.id, "delete", "Subscriber", row.id);
  revalidatePath("/admin/subscribers");
  return done("Deleted.");
}

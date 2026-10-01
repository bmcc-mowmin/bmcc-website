"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSection } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { done, fail, text } from "@/lib/admin/forms";
import type { ActionResult } from "@/components/admin/ActionForm";

export async function setMessageHandled(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireSection("messages");
  const id = text(form, "id");
  const handled = text(form, "handled") === "1";
  const row = await db.contactMessage.findUnique({ where: { id } });
  if (!row) return fail("Message not found.");
  await db.contactMessage.update({ where: { id }, data: handled ? { status: "HANDLED", handledAt: new Date() } : { status: "NEW", handledAt: null } });
  await audit(user.id, handled ? "mark_handled" : "reopen", "ContactMessage", id);
  revalidatePath("/admin", "layout");
  return done(handled ? "Marked handled." : "Moved back to New.");
}

export async function deleteMessage(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireSection("messages");
  const id = text(form, "id");
  const { count } = await db.contactMessage.deleteMany({ where: { id } });
  if (!count) return fail("Message not found.");
  await audit(user.id, "delete", "ContactMessage", id);
  revalidatePath("/admin", "layout");
  redirect("/admin/messages?deleted=1");
}

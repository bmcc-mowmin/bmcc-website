"use server";

import { requireSection } from "@/lib/auth";
import { erasePerson } from "@/lib/privacy/erase";
import { done, fail, text } from "@/lib/admin/forms";
import type { ActionResult } from "@/components/admin/ActionForm";

// Erases a person after the admin retyped their email to confirm (Super admins only).
export async function eraseAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireSection("privacy");
  const email = text(form, "email").toLowerCase();
  if (!email || text(form, "confirm").toLowerCase() !== email) return fail("Type the email address exactly to confirm.");
  const result = await erasePerson(email, admin);
  if (!result.ok) return fail(result.message);
  return done([result.summary, ...result.warnings].join(" "));
}

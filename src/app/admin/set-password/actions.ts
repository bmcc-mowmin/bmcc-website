"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { consumeToken } from "@/lib/auth/tokens";
import { createSession } from "@/lib/auth/session";

export type SetPasswordState = { error?: string } | undefined;

export async function setPassword(_prev: SetPasswordState, form: FormData): Promise<SetPasswordState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 12) return { error: "Use at least 12 characters." };
  if (password.length > 200) return { error: "That password is too long." };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const user = await consumeToken(token, "set_password");
  if (!user) return { error: "This link has expired or was already used. Ask a Super admin to resend your invite." };

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(password, 10), lastLoginAt: new Date() } });
  await audit(user.id, "set_password", "User", user.id);
  await createSession(user.id);
  redirect("/admin?welcome=1");
}

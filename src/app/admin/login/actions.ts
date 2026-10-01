"use server";

import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth/session";
import { passwordLogin, safeNext } from "@/lib/auth/password-login";
import { isStaff } from "@/lib/auth/permissions";

export type AdminLoginState = { error?: string; email?: string } | undefined;

const MESSAGES = {
  login_error: "The email or password is incorrect.",
  login_rate_limited: "Too many sign-in attempts. Please wait a few minutes and try again.",
};

export async function adminLogin(_prev: AdminLoginState, form: FormData): Promise<AdminLoginState> {
  const email = String(form.get("email") ?? "");
  const result = await passwordLogin(email, String(form.get("password") ?? ""));
  if (!result.ok) return { error: MESSAGES[result.error], email };
  if (!isStaff(result.adminRoles)) {
    await destroySession();
    return { error: "This account doesn't have access to the admin portal.", email };
  }
  redirect(safeNext(form.get("next"), "/admin"));
}

export async function adminLogout() {
  await destroySession();
  redirect("/admin/login");
}

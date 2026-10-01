"use server";

import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth/session";
import { passwordLogin, safeNext } from "@/lib/auth/password-login";
import { isStaff } from "@/lib/auth/permissions";

// Public sign-in (members; replaced by Clerk in the member-login phase).
// `email` is echoed back so the form keeps it after a failed attempt.
export type LoginState = { error?: "login_error" | "login_rate_limited"; email?: string } | undefined;

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "");
  const result = await passwordLogin(email, String(form.get("password") ?? ""));
  if (!result.ok) return { error: result.error, email };
  redirect(safeNext(form.get("next"), isStaff(result.adminRoles) ? "/admin" : "/"));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

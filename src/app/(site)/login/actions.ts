"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { destroySession } from "@/lib/auth/session";
import { passwordLogin, safeNext } from "@/lib/auth/password-login";
import { requestSignInLink, signInWithLink } from "@/lib/auth/sign-in-link";
import { isStaff } from "@/lib/auth/permissions";
import { getLang } from "@/lib/i18n/server";
import { checkHoneypot } from "@/lib/security/honeypot";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/request";

// Public sign-in (AUTH_PROVIDER=dev; Clerk's sign-in replaces this page in production).
// `email` is echoed back so the form keeps it after a failed attempt.
export type LoginState = { error?: "login_error" | "login_rate_limited"; email?: string } | undefined;

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "");
  const result = await passwordLogin(email, String(form.get("password") ?? ""));
  if (!result.ok) return { error: result.error, email };
  redirect(safeNext(form.get("next"), isStaff(result.adminRoles) ? "/admin" : "/account"));
}

export type LinkState = { status: "idle" } | { status: "sent"; email: string } | { status: "error"; error: "form_error_email" | "form_rate_limited" | "form_try_again"; email: string };

export async function emailSignInLink(_prev: LinkState, form: FormData): Promise<LinkState> {
  const email = String(form.get("email") ?? "").trim();
  const spam = checkHoneypot(form);
  if (spam.reason === "honeypot") return { status: "sent", email };
  if (spam.reason === "too_fast") return { status: "error", error: "form_try_again", email };
  if (!(await rateLimit(`signin-link:ip:${await clientIp()}`))) return { status: "error", error: "form_rate_limited", email };
  if (!z.email().safeParse(email).success) return { status: "error", error: "form_error_email", email };
  await requestSignInLink(email, await getLang(), String(form.get("next") ?? ""));
  return { status: "sent", email };
}

export async function signInFromLink(form: FormData) {
  const ok = await signInWithLink(String(form.get("token") ?? ""));
  redirect(ok ? safeNext(form.get("next"), "/account") : "/login/link?expired=1");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

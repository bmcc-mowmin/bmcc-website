"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createSession, destroySession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/request";

// Compared against when the email doesn't exist, so response time doesn't reveal accounts.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

// `email` is echoed back so the form keeps it after a failed attempt.
export type LoginState = { error?: "login_error" | "login_rate_limited"; email?: string } | undefined;

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
  next: z.string().optional(),
});

// Only same-site paths, never "//evil.example" or absolute URLs.
function safeNext(next: string | undefined, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  if (env.AUTH_PROVIDER !== "dev") return { error: "login_error" };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "login_error", email: String(form.get("email") ?? "") };
  const { email, password, next } = parsed.data;

  const ip = await clientIp();
  const allowed =
    (await rateLimit(`login:ip:${ip}`, { max: 10, windowSec: 600 })) &&
    (await rateLimit(`login:email:${email}`, { max: 5, windowSec: 600 }));
  if (!allowed) return { error: "login_rate_limited", email };

  const user = await db.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return { error: "login_error", email };

  await createSession(user.id);
  redirect(safeNext(next, user.role === "ADMIN" ? "/admin" : "/"));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

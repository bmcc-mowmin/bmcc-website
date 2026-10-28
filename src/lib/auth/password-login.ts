import "server-only";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/request";
import { createSession, MEMBER_SESSION_SEC, STAFF_SESSION_SEC } from "./session";
import { isStaff } from "./permissions";

// Email + password sign-in for AUTH_PROVIDER=dev (local test accounts and invited admins).

// Compared against when the email doesn't exist, so response time doesn't reveal accounts.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export type PasswordLoginResult =
  | { ok: true; userId: string; adminRoles: string[] }
  | { ok: false; error: "login_error" | "login_rate_limited" };

export async function passwordLogin(emailRaw: string, password: string): Promise<PasswordLoginResult> {
  if (env.AUTH_PROVIDER !== "dev") return { ok: false, error: "login_error" };
  const email = emailRaw.trim().toLowerCase();
  if (!email || !password || password.length > 200) return { ok: false, error: "login_error" };

  const ip = await clientIp();
  const allowed =
    (await rateLimit(`login:ip:${ip}`, { max: 10, windowSec: 600 })) && (await rateLimit(`login:email:${email}`, { max: 5, windowSec: 600 }));
  if (!allowed) return { ok: false, error: "login_rate_limited" };

  const user = await db.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || user.disabled) return { ok: false, error: "login_error" };

  await createSession(user.id, isStaff(user.adminRoles) ? STAFF_SESSION_SEC : MEMBER_SESSION_SEC);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { ok: true, userId: user.id, adminRoles: user.adminRoles };
}

// Same-site redirect targets only (kept here for existing imports).
export { safeNext } from "@/lib/security/safe-path";

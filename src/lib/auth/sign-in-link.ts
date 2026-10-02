import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/security/rate-limit";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { Lang } from "@/lib/i18n/config";
import { buttonHtml, escapeHtml, layoutHtml, sendMail } from "@/lib/mail";
import { consumeToken, createToken, peekToken } from "./tokens";
import { createSession, MEMBER_SESSION_SEC } from "./session";
import { isStaff } from "./permissions";
import { safeNext } from "./password-login";

// Passwordless member sign-in for AUTH_PROVIDER=dev: an emailed one-time link (Clerk offers the
// same with email codes in production). Works for anyone BMCC knows by email — a donor, a member,
// or someone whose membership application is waiting for payment. Staff sign in with a password
// (admin access must not hang on an email link).
// BMCC chose to tell visitors when an address isn't on file (with a "become a member" link), so
// the answer says whether an address is known; rate limits keep that from being used for lookups.

const PURPOSE = "sign_in";
const TTL_HOURS = 0.5;

async function memberAccountFor(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (user) return user.disabled ? null : isStaff(user.adminRoles) ? "staff" : user;
  // An application that hasn't been paid yet has a household but no account; create it.
  const household = await db.household.findFirst({ where: { email }, orderBy: { createdAt: "desc" } });
  if (!household) return null;
  const created = await db.user.create({ data: { email } });
  await db.household.updateMany({ where: { email, primaryUserId: null }, data: { primaryUserId: created.id } });
  return created;
}

export type SignInLinkResult = "sent" | "not_found" | "staff" | "too_many";

export async function requestSignInLink(emailRaw: string, lang: Lang, next: string): Promise<SignInLinkResult> {
  const email = emailRaw.trim().toLowerCase();
  const user = await memberAccountFor(email);
  if (!user) return "not_found";
  if (user === "staff") return "staff";
  if (!(await rateLimit(`signin-link:${email}`, { max: 3, windowSec: 3600 }))) return "too_many";
  const token = await createToken(user.id, PURPOSE, TTL_HOURS);
  const url = `${env.APP_URL}/login/link?token=${token}&next=${encodeURIComponent(safeNext(next, "/account"))}`;
  const t = getDictionary(lang);
  await sendMail({
    to: email,
    subject: t.signin_email_subject,
    text: `${t.signin_email_body}\n\n${t.signin_email_button}: ${url}\n\n${t.signin_email_ignore}\n\nBrentwood Muslim Community Center`,
    html: layoutHtml(t.signin_email_subject, `<p>${escapeHtml(t.signin_email_body)}</p>${buttonHtml(url, t.signin_email_button)}<p style="color:#6b7280;font-size:13px">${escapeHtml(t.signin_email_ignore)}</p>`),
  });
  return "sent";
}

// For the landing page: is the link still good? (Opening it signs nobody in — a button does.)
export async function signInLinkValid(token: string) {
  return !!(await peekToken(token, PURPOSE));
}

export async function signInWithLink(token: string) {
  const user = await consumeToken(token, PURPOSE);
  if (!user || isStaff(user.adminRoles)) return false;
  await createSession(user.id, MEMBER_SESSION_SEC);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return true;
}

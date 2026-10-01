import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/security/rate-limit";
import { getDictionary } from "@/lib/i18n/dictionary";
import { isLang, type Lang } from "@/lib/i18n/config";
import { buttonHtml, escapeHtml, layoutHtml, sendMail } from "@/lib/mail";

// The BMCC mailing list with double opt-in. Both Home forms (the re-subscribe bar and "Stay
// Connected") call requestSubscription(); nobody is on the list until they press the button
// behind the emailed link. The confirmation link carries a random token whose SHA-256 hash is
// stored; the unsubscribe link carries a separate random token that never expires.

export const SOURCES = ["resub_bar", "newsletter"] as const;
export type Source = (typeof SOURCES)[number];

const CONFIRM_TTL_DAYS = 7;
// Limits how often one address can be sent a confirmation link (stops the form being used to
// flood someone else's inbox).
const EMAILS_PER_ADDRESS_PER_DAY = 3;

const hash = (raw: string) => createHash("sha256").update(raw).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

export const confirmUrl = (token: string) => `${env.APP_URL}/subscribe/confirm?token=${token}`;
export const unsubscribeUrl = (token: string) => `${env.APP_URL}/unsubscribe?token=${token}`;

// Always resolves the same way whatever the address's state, so the form never reveals who is
// already on the list.
export async function requestSubscription({ email, source, lang }: { email: string; source: Source; lang: Lang }) {
  const address = email.trim().toLowerCase();
  const existing = await db.subscriber.findUnique({ where: { email: address } });
  if (existing?.status === "CONFIRMED") return;
  if (!(await rateLimit(`subscribe-email:${address}`, { max: EMAILS_PER_ADDRESS_PER_DAY, windowSec: 86_400 }))) return;

  const token = newToken();
  const pending = {
    status: "PENDING" as const,
    lang,
    confirmTokenHash: hash(token),
    tokenExpiresAt: new Date(Date.now() + CONFIRM_TTL_DAYS * 86_400_000),
  };
  if (existing) {
    // A new link replaces the old one; a person who unsubscribed must confirm again.
    await db.subscriber.update({ where: { id: existing.id }, data: { ...pending, unsubscribedAt: null } });
  } else {
    await db.subscriber.create({ data: { ...pending, email: address, source, unsubscribeToken: newToken() } });
  }
  await sendConfirmation(address, token, lang);
}

async function sendConfirmation(to: string, token: string, lang: Lang) {
  const t = getDictionary(lang);
  const url = confirmUrl(token);
  await sendMail({
    to,
    subject: t.sub_email_subject,
    text: `${t.sub_email_body}\n\n${t.sub_email_button}: ${url}\n\n${t.sub_email_ignore}\n\nBrentwood Muslim Community Center`,
    html: layoutHtml(t.sub_email_heading, `<p>${escapeHtml(t.sub_email_body)}</p>${buttonHtml(url, t.sub_email_button)}<p style="color:#6b7280;font-size:13px">${escapeHtml(t.sub_email_ignore)}</p>`),
  });
}

// For the confirmation page: who the link is for, without changing anything (mail scanners open
// links, so confirming takes a button press, not just a visit).
export async function peekConfirmation(token: string) {
  if (!token || token.length > 100) return null;
  const row = await db.subscriber.findUnique({ where: { confirmTokenHash: hash(token) } });
  if (!row || row.status !== "PENDING" || !row.tokenExpiresAt || row.tokenExpiresAt < new Date()) return null;
  return row;
}

export async function confirmSubscription(token: string, ip: string | null) {
  const row = await peekConfirmation(token);
  if (!row) return null;
  // Only one request can win: the update matches only while the token is still there.
  const { count } = await db.subscriber.updateMany({
    where: { id: row.id, status: "PENDING", confirmTokenHash: row.confirmTokenHash },
    data: { status: "CONFIRMED", confirmedAt: new Date(), consentIp: ip, confirmTokenHash: null, tokenExpiresAt: null },
  });
  if (count !== 1) return null;
  const lang = isLang(row.lang) ? row.lang : "en";
  await sendWelcome(row.email, row.unsubscribeToken, lang).catch((e) => console.error("subscription welcome email failed", e));
  return row;
}

// Every list email carries an unsubscribe link plus the List-Unsubscribe headers that mail apps
// show as a one-click "Unsubscribe" button (RFC 8058, answered by /api/unsubscribe).
export function listHeaders(unsubscribeToken: string) {
  return {
    "List-Unsubscribe": `<${env.APP_URL}/api/unsubscribe?token=${unsubscribeToken}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

async function sendWelcome(to: string, unsubscribeToken: string, lang: Lang) {
  const t = getDictionary(lang);
  const unsub = unsubscribeUrl(unsubscribeToken);
  await sendMail({
    to,
    subject: t.sub_welcome_subject,
    text: `${t.sub_welcome_body}\n\n${t.sub_unsubscribe_hint} ${unsub}\n\nBrentwood Muslim Community Center`,
    html: layoutHtml(t.sub_confirmed_title, `<p>${escapeHtml(t.sub_welcome_body)}</p><p style="color:#6b7280;font-size:13px">${escapeHtml(t.sub_unsubscribe_hint)} <a href="${unsub}">${escapeHtml(t.unsub_button)}</a></p>`),
    headers: listHeaders(unsubscribeToken),
  });
}

export async function findByUnsubscribeToken(token: string) {
  if (!token || token.length > 100) return null;
  return db.subscriber.findUnique({ where: { unsubscribeToken: token } });
}

export async function unsubscribe(token: string) {
  const row = await findByUnsubscribeToken(token);
  if (!row) return null;
  if (row.status !== "UNSUBSCRIBED") {
    await db.subscriber.update({ where: { id: row.id }, data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date(), confirmTokenHash: null, tokenExpiresAt: null } });
  }
  return row;
}

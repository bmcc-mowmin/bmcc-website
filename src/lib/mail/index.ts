import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";

// The ONE way the site sends email. Locally MAIL_TRANSPORT=smtp points at Mailpit
// (http://localhost:8025); production switches provider through settings only:
//   smtp     → any SMTP relay (SMTP_HOST/PORT/USER/PASSWORD)
//   resend   → Resend HTTP API (MAIL_PROVIDER_API_KEY)
//   postmark → Postmark HTTP API (MAIL_PROVIDER_API_KEY)

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  headers?: Record<string, string>;
};

let smtp: Transporter | null = null;
function smtpTransport() {
  smtp ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  return smtp;
}

async function viaHttp(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Email provider error ${res.status}: ${await res.text()}`);
}

export async function sendMail(mail: Mail) {
  const replyTo = mail.replyTo ?? env.MAIL_REPLY_TO;
  switch (env.MAIL_TRANSPORT) {
    case "smtp":
      await smtpTransport().sendMail({ from: env.MAIL_FROM, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html, replyTo, headers: mail.headers });
      return;
    case "resend":
      await viaHttp("https://api.resend.com/emails", { Authorization: `Bearer ${env.MAIL_PROVIDER_API_KEY}` }, {
        from: env.MAIL_FROM,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        reply_to: replyTo,
        headers: mail.headers,
      });
      return;
    case "postmark":
      await viaHttp("https://api.postmarkapp.com/email", { "X-Postmark-Server-Token": env.MAIL_PROVIDER_API_KEY! }, {
        From: env.MAIL_FROM,
        To: mail.to,
        Subject: mail.subject,
        TextBody: mail.text,
        HtmlBody: mail.html,
        ReplyTo: replyTo,
        Headers: Object.entries(mail.headers ?? {}).map(([Name, Value]) => ({ Name, Value })),
        MessageStream: "outbound",
      });
      return;
  }
}

// Minimal, readable HTML wrapper for transactional emails.
export function layoutHtml(title: string, bodyHtml: string) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:Inter,Arial,sans-serif;color:#101828">
<div style="max-width:560px;margin:0 auto;padding:28px 20px">
<div style="background:#101d33;color:#eef2f8;padding:16px 22px;border-radius:12px 12px 0 0;font-weight:800">Brentwood Muslim Community Center</div>
<div style="background:#fff;border:1px solid #e2e5ea;border-top:none;border-radius:0 0 12px 12px;padding:24px 22px;line-height:1.6;font-size:15px">
<h1 style="font-size:20px;margin:0 0 14px;color:#0b1524">${esc(title)}</h1>
${bodyHtml}
</div></div></body></html>`;
}

export function buttonHtml(href: string, label: string) {
  return `<p style="margin:22px 0"><a href="${href}" style="background:#2f6fed;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;display:inline-block">${label}</a></p>`;
}

import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { adminUrl } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { getDictionary } from "@/lib/i18n/dictionary";
import { isLang, type Lang } from "@/lib/i18n/config";
import { storage } from "@/lib/storage";
import { escapeHtml, layoutHtml, sendMail } from "@/lib/mail";
import { areaLabel, bugRef, CATEGORY_LABEL, detectAttachment, guessArea, IMPACT_LABEL, priorityLabel, type Category, type Impact } from "./rules";

// Filing bug reports and the emails around them. Rules and labels are in ./rules.

const oneLine = (s: string) => s.replace(/[\r\n\t]+/g, " ").slice(0, 150);

export type NewBug = {
  title: string;
  description: string;
  steps: string | null;
  expected: string | null;
  pageUrl: string | null;
  category: Category;
  impact: Impact;
  reporterName: string | null;
  reporterEmail: string | null;
  reporterId: string | null;
  userAgent: string | null;
  language: string | null;
  viewport: string | null;
};

// Files are checked (type from their first bytes, size) by the caller before this is called.
export async function fileBugReport(bug: NewBug, files: { bytes: Buffer; name: string }[]) {
  const stored: { storageKey: string; filename: string; contentType: string; sizeBytes: number }[] = [];
  for (const f of files) {
    const kind = detectAttachment(f.bytes)!;
    const storageKey = `bugs/${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.${kind.ext}`;
    await storage.put(storageKey, f.bytes, kind.type);
    stored.push({ storageKey, filename: f.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || `file.${kind.ext}`, contentType: kind.type, sizeBytes: f.bytes.length });
  }
  const row = await db.bugReport.create({
    data: {
      ...bug,
      area: guessArea(bug.pageUrl, bug.category),
      attachments: { create: stored },
      events: { create: { kind: "created", actorId: bug.reporterId } },
    },
  });
  await notifyNewBug(row.id).catch((e) => console.error("bug notification failed", e));
  return row;
}

// Super admins triage; without any, the office inbox gets the alert.
async function triageInboxes() {
  const admins = await db.user.findMany({ where: { adminRoles: { has: "SUPER_ADMIN" }, disabled: false }, select: { email: true } });
  return admins.length ? admins.map((a) => a.email) : [(await getSettings()).contactInbox];
}

const bugLink = (number: number) => adminUrl(`/admin/bugs/${number}`);

async function notifyNewBug(id: string) {
  const bug = await db.bugReport.findUniqueOrThrow({ where: { id }, include: { attachments: true } });
  const ref = bugRef(bug.number);
  const lines = [
    `${ref}: ${bug.title}`,
    `Type: ${CATEGORY_LABEL[bug.category as Category] ?? bug.category}`,
    `Impact: ${IMPACT_LABEL[bug.impact as Impact] ?? bug.impact}`,
    `Page: ${bug.pageUrl ?? "—"}`,
    `Suggested area: ${areaLabel(bug.area)}`,
    `Attachments: ${bug.attachments.length}`,
  ];
  const to = await triageInboxes();
  await Promise.allSettled(
    to.map((address) =>
      sendMail({
        to: address,
        subject: `[Bug ${ref}] New report — ${oneLine(bug.title)}`,
        text: `A new bug report needs triage.\n\n${lines.join("\n")}\n\n${bug.description}\n\nTriage it: ${bugLink(bug.number)}`,
        html: layoutHtml(
          `New bug report ${ref}`,
          `<p>${lines.map(escapeHtml).join("<br>")}</p><p style="white-space:pre-line;border-inline-start:3px solid #d7e4fb;padding-inline-start:12px">${escapeHtml(bug.description)}</p><p><a href="${bugLink(bug.number)}">Triage ${ref}</a></p>`,
        ),
      }),
    ),
  );

  // A short acknowledgement with the reference, in the reporter's language. It doesn't repeat what
  // was written, so the form can't be used to send someone else arbitrary text.
  if (bug.reporterEmail) {
    const t = getDictionary(isLang(bug.language) ? (bug.language as Lang) : "en");
    const subject = t.bug_email_ack_subject.replace("{ref}", ref);
    const body = t.bug_email_ack_body.replace("{ref}", ref);
    await sendMail({ to: bug.reporterEmail, subject, text: `${body}\n\nBrentwood Muslim Community Center`, html: layoutHtml(subject, `<p>${escapeHtml(body)}</p>`) });
  }
}

export async function notifyAssignee(bugId: string, assigneeId: string, byName: string) {
  const bug = await db.bugReport.findUniqueOrThrow({ where: { id: bugId }, include: { assignee: true } });
  if (!bug.assignee || bug.assignee.id !== assigneeId) return;
  const ref = bugRef(bug.number);
  const due = bug.dueAt ? ` · due ${bug.dueAt.toDateString()}` : "";
  await sendMail({
    to: bug.assignee.email,
    subject: `[Bug ${ref}] Assigned to you — ${oneLine(bug.title)}`,
    text: `${byName} assigned ${ref} to you.\n\n${priorityLabel(bug.priority)} · ${areaLabel(bug.area)}${due}\n\n${bug.description}\n\nOpen it: ${bugLink(bug.number)}`,
    html: layoutHtml(
      `${ref} is assigned to you`,
      `<p>${escapeHtml(byName)} assigned <strong>${escapeHtml(ref)}: ${escapeHtml(bug.title)}</strong> to you.</p><p>${escapeHtml(priorityLabel(bug.priority))} · ${escapeHtml(areaLabel(bug.area))}${escapeHtml(due)}</p><p><a href="${bugLink(bug.number)}">Open ${ref}</a></p>`,
    ),
  });
}

// Tells the reporter about a reply from BMCC, or that the report was fixed or closed.
export async function notifyReporter(bugId: string, kind: "reply" | "status", message?: string) {
  const bug = await db.bugReport.findUniqueOrThrow({ where: { id: bugId } });
  if (!bug.reporterEmail) return false;
  const t = getDictionary(isLang(bug.language) ? (bug.language as Lang) : "en");
  const ref = bugRef(bug.number);
  let body = "";
  if (kind === "reply") body = message ?? "";
  else if (bug.status === "FIXED") body = t.bug_email_fixed_body.replace("{ref}", ref);
  else if (bug.status === "NEED_INFO") body = t.bug_email_need_info_body.replace("{ref}", ref);
  else body = t.bug_email_closed_body.replace("{ref}", ref);
  if (!body) return false;
  const subject = t.bug_email_update_subject.replace("{ref}", ref);
  const inbox = (await getSettings()).contactInbox;
  await sendMail({
    to: bug.reporterEmail,
    replyTo: inbox,
    subject,
    text: `${body}\n\n${t.bug_email_reply_hint}\n\nBrentwood Muslim Community Center`,
    html: layoutHtml(subject, `<p style="white-space:pre-line">${escapeHtml(body)}</p><p style="color:#6b7280;font-size:13px">${escapeHtml(t.bug_email_reply_hint)}</p>`),
  });
  return true;
}

export async function deleteBugFiles(bugId: string) {
  const files = await db.bugAttachment.findMany({ where: { bugId }, select: { storageKey: true } });
  await Promise.allSettled(files.map((f) => storage.remove(f.storageKey)));
}

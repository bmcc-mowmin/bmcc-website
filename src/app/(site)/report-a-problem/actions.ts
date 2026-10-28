"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getLang } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getCurrentUser } from "@/lib/auth";
import { checkHoneypot } from "@/lib/security/honeypot";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/request";
import { fieldErrors } from "@/lib/directory/listing";
import { fileBugReport } from "@/lib/bugs";
import { bugRef, detectAttachment, isCategory, isImpact, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS, MAX_TOTAL_ATTACHMENT_BYTES } from "@/lib/bugs/rules";

export type ReportState =
  | { status: "idle" }
  | { status: "done"; ref: string; emailed: boolean }
  | { status: "error"; message: string; errors: Record<string, string>; values: Record<string, string> };

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const schema = z.object({
  title: z.string().trim().min(3, "form_error_required").max(150),
  category: z.string().refine(isCategory, "form_error_required"),
  impact: z.string().refine(isImpact, "form_error_required"),
  description: z.string().trim().min(5, "form_error_required").max(5000),
  steps: optional(3000),
  expected: optional(2000),
  pageUrl: optional(500),
  name: optional(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .transform((v) => v || null)
    .pipe(z.email({ message: "form_error_email" }).nullable()),
  viewport: optional(40),
});

const FIELDS = ["title", "category", "impact", "description", "steps", "expected", "pageUrl", "name", "email", "viewport"] as const;

export async function submitBugReport(_prev: ReportState, form: FormData): Promise<ReportState> {
  const lang = await getLang();
  const t = getDictionary(lang);
  const values = Object.fromEntries(FIELDS.map((f) => [f, String(form.get(f) ?? "")])) as Record<(typeof FIELDS)[number], string>;

  const spam = checkHoneypot(form);
  if (spam.reason === "honeypot") return { status: "done", ref: "", emailed: false };
  if (spam.reason === "too_fast") return { status: "error", message: t.form_try_again, errors: {}, values };
  if (!(await rateLimit(`bug:${await clientIp()}`, { max: 5, windowSec: 3600 }))) return { status: "error", message: t.form_rate_limited, errors: {}, values };

  const parsed = schema.safeParse(values);
  if (!parsed.success) return { status: "error", message: t.bug_error_fix_fields, errors: fieldErrors(parsed.error), values };
  const p = parsed.data;

  // Attachments: up to 3 screenshots (JPEG/PNG/WebP) or PDFs, 5 MB each, 10 MB in all.
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const total = files.reduce((n, f) => n + f.size, 0);
  if (files.length > MAX_ATTACHMENTS || files.some((f) => f.size > MAX_ATTACHMENT_BYTES) || total > MAX_TOTAL_ATTACHMENT_BYTES) {
    return { status: "error", message: t.bug_error_files, errors: { files: "bug_files_hint" }, values };
  }
  const read = await Promise.all(files.map(async (f) => ({ bytes: Buffer.from(await f.arrayBuffer()), name: f.name })));
  if (read.some((f) => !detectAttachment(f.bytes))) return { status: "error", message: t.bug_error_files, errors: { files: "bug_files_hint" }, values };

  // Signed in: the report is linked to the account and uses its email when none was typed.
  const user = await getCurrentUser();
  const email = p.email ?? user?.email ?? null;
  const bug = await fileBugReport(
    {
      title: p.title,
      description: p.description,
      steps: p.steps,
      expected: p.expected,
      pageUrl: p.pageUrl,
      category: p.category as never,
      impact: p.impact as never,
      reporterName: p.name ?? user?.name ?? null,
      reporterEmail: email,
      reporterId: user?.id ?? null,
      userAgent: (await headers()).get("user-agent")?.slice(0, 300) ?? null,
      language: lang,
      viewport: p.viewport,
    },
    read,
  );
  return { status: "done", ref: bugRef(bug.number), emailed: !!email };
}

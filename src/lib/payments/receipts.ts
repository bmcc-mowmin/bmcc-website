import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { org } from "@/lib/org";
import { escapeHtml, layoutHtml, sendMail } from "@/lib/mail";
import { FUND_LABELS, isFund, usd } from "./catalog";

// Receipt numbers come from a Postgres sequence: BMCC-2026-000001.
export async function nextReceiptNumber(tx: Prisma.TransactionClient, at: Date) {
  const [{ n }] = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('receipt_number_seq') AS n`;
  return `BMCC-${at.getUTCFullYear()}-${String(n).padStart(6, "0")}`;
}

type ReceiptPayment = {
  receiptNumber: string | null;
  kind: "DONATION" | "DUES";
  fund: string | null;
  frequency: "ONE_TIME" | "MONTHLY" | "YEARLY";
  amountCents: number;
  donorName: string | null;
  donorEmail: string;
  paidAt: Date | null;
};

// The text of a receipt. GO_LIVE.md: BMCC's accountant approves this wording and the EIN is set.
export function receiptText(p: ReceiptPayment) {
  const date = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "America/Los_Angeles" }).format(p.paidAt ?? new Date());
  const what =
    p.kind === "DUES"
      ? `Membership dues (${p.frequency === "YEARLY" ? "yearly" : "monthly"})`
      : `Donation — ${isFund(p.fund) ? FUND_LABELS[p.fund] : "General"}${p.frequency === "MONTHLY" ? " (monthly)" : ""}`;
  const lines = [
    `${org.legalName}`,
    `${org.address}`,
    env.ORG_EIN ? `EIN: ${env.ORG_EIN}` : "",
    "",
    `Receipt number: ${p.receiptNumber}`,
    `Date: ${date}`,
    `Received from: ${p.donorName ?? p.donorEmail}`,
    `${what}: ${usd(p.amountCents)}`,
    "",
    p.kind === "DONATION"
      ? `${org.legalName} is a 501(c)(3) nonprofit organization. No goods or services were provided in exchange for this contribution.`
      : "Membership dues include member benefits (such as the Funeral Services Benefit); please consult your tax advisor about deductibility.",
  ];
  return lines.filter((l, i) => l !== "" || lines[i - 1] !== "").join("\n").trim();
}

export async function emailReceipt(p: ReceiptPayment) {
  const text = receiptText(p);
  const thanks =
    p.kind === "DUES" ? "Thank you — your membership dues were received." : "JazakAllah Khair — thank you for your generous gift to BMCC.";
  await sendMail({
    to: p.donorEmail,
    subject: `Your BMCC receipt ${p.receiptNumber}`,
    text: `${thanks}\n\n${text}\n\nKeep this email for your records.`,
    html: layoutHtml(
      `Receipt ${p.receiptNumber}`,
      `<p>${escapeHtml(thanks)}</p><pre style="font-family:inherit;white-space:pre-wrap;background:#f6f7f9;border:1px solid #e2e5ea;border-radius:8px;padding:14px">${escapeHtml(text)}</pre><p style="color:#6b7280;font-size:13px">Keep this email for your records.</p>`,
    ),
  });
}

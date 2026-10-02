import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { requireMember } from "@/lib/auth";
import { getMyPayment } from "@/lib/account";
import { receiptText } from "@/lib/payments/receipts";
import { getOrg } from "@/lib/org";
import { PrintButton } from "../../PrintButton";
import styles from "../../account.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.receipt_number, robots: { index: false } };
}

// A printable copy of one receipt. The receipt itself is in English: it is the official record
// for tax purposes (wording approved by BMCC's accountant — GO_LIVE.md).
export default async function ReceiptPage({ params }: PageProps<"/account/giving/[id]">) {
  const { id } = await params;
  const user = await requireMember(`/account/giving/${id}`);
  const { t } = await getI18n();
  const payment = await getMyPayment(user, id);
  if (!payment?.receiptNumber) notFound();
  const org = await getOrg();
  return (
    <>
      <div className={`${styles.printBar} no-print`}>
        <Link href="/account/giving">← {t.acct_tab_giving}</Link>
        <PrintButton label={t.acct_print} />
      </div>
      <p className={`${styles.small} no-print`}>{t.acct_receipt_english_note}</p>
      <article className={`${styles.doc} print-doc`} lang="en" dir="ltr">
        <h2 className={styles.docTitle}>{payment.kind === "DONATION" ? "Donation receipt" : "Payment receipt"}</h2>
        <pre className={styles.docText}>{receiptText(payment, org)}</pre>
        {payment.status === "REFUNDED" && <p className={styles.docNote}>This payment was refunded.</p>}
      </article>
    </>
  );
}

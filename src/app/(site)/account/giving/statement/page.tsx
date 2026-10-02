import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { requireMember } from "@/lib/auth";
import { getMyPayments } from "@/lib/account";
import { env } from "@/lib/env";
import { org } from "@/lib/org";
import { masjidClock } from "@/lib/prayer/schedule";
import { FUND_LABELS, isFund, usd } from "@/lib/payments/catalog";
import { zonedDate } from "@/lib/time";
import { PrintButton } from "../../PrintButton";
import styles from "../../account.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.acct_tab_giving, robots: { index: false } };
}

// Year-end giving statement (donations only; dues include member benefits). English, like receipts.
export default async function StatementPage({ searchParams }: PageProps<"/account/giving/statement">) {
  const { year } = await searchParams;
  if (typeof year !== "string" || !/^\d{4}$/.test(year)) notFound();
  const user = await requireMember(`/account/giving/statement?year=${year}`);
  const { t } = await getI18n();
  const [payments, { timeZone }] = await Promise.all([getMyPayments(user), masjidClock()]);
  const gifts = payments
    .filter((p) => p.kind === "DONATION" && p.status === "SUCCEEDED" && p.paidAt && zonedDate(p.paidAt, timeZone).startsWith(year))
    .sort((a, b) => a.paidAt!.getTime() - b.paidAt!.getTime());
  const total = gifts.reduce((sum, p) => sum + p.amountCents, 0);
  const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone });
  const donor = gifts.find((g) => g.donorName)?.donorName ?? user.name ?? user.email;

  return (
    <>
      <div className={`${styles.printBar} no-print`}>
        <Link href="/account/giving">← {t.acct_tab_giving}</Link>
        <PrintButton label={t.acct_print} />
      </div>
      <p className={`${styles.small} no-print`}>{t.acct_receipt_english_note}</p>
      <article className={`${styles.doc} print-doc`} lang="en" dir="ltr">
        <h2 className={styles.docTitle}>{year} giving statement</h2>
        <p className={styles.docText}>
          {org.legalName}
          <br />
          {org.address}
          {env.ORG_EIN && (
            <>
              <br />
              EIN: {env.ORG_EIN}
            </>
          )}
        </p>
        <p className={styles.docText}>
          Donor: {donor} ({user.email})
        </p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Receipt</th>
              <th>Fund</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {gifts.map((g) => (
              <tr key={g.id}>
                <td>{day.format(g.paidAt!)}</td>
                <td>{g.receiptNumber}</td>
                <td>{isFund(g.fund) ? FUND_LABELS[g.fund] : "General"}</td>
                <td style={{ textAlign: "right" }}>{usd(g.amountCents)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3}>
                <strong>Total donations in {year}</strong>
              </td>
              <td style={{ textAlign: "right" }}>
                <strong>{usd(total)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
        <p className={styles.docNote}>
          {org.legalName} is a 501(c)(3) nonprofit organization. No goods or services were provided in exchange for these contributions. Membership dues are
          not included in this statement.
        </p>
      </article>
    </>
  );
}

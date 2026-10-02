import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { requireMember } from "@/lib/auth";
import { getMyPayments, getMyRecurringGifts } from "@/lib/account";
import { masjidClock } from "@/lib/prayer/schedule";
import { usd } from "@/lib/payments/catalog";
import { routes } from "@/lib/routes";
import { zonedDate } from "@/lib/time";
import { cancelMonthlyGift } from "../actions";
import { formatDate, paymentLabel } from "../format";
import { ConfirmButton } from "../ConfirmButton";
import styles from "../account.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.acct_tab_giving, robots: { index: false } };
}

export default async function GivingPage({ searchParams }: PageProps<"/account/giving">) {
  const user = await requireMember("/account/giving");
  const { t, lang } = await getI18n();
  const { canceled } = await searchParams;
  const [payments, gifts, { timeZone }] = await Promise.all([getMyPayments(user), getMyRecurringGifts(user), masjidClock()]);
  const date = (d: Date) => formatDate(d, lang, timeZone);
  // Years with at least one donation get a tax statement.
  const years = [...new Set(payments.filter((p) => p.kind === "DONATION" && p.paidAt && p.status === "SUCCEEDED").map((p) => zonedDate(p.paidAt!, timeZone).slice(0, 4)))];

  return (
    <>
      {canceled && (
        <p role="status" className={`${styles.ok} ${styles.banner}`}>
          {t.acct_gift_canceled}
        </p>
      )}
      <section className={styles.card} aria-labelledby="recurring-title">
        <h2 id="recurring-title" className={styles.cardTitle}>
          {t.acct_recurring_title}
        </h2>
        {gifts.length === 0 ? (
          <p className={styles.text}>
            {t.acct_recurring_none} <Link href={routes.donate}>{t.nav_donate} →</Link>
          </p>
        ) : (
          <ul className={styles.people}>
            {gifts.map((g) => (
              <li key={g.id}>
                <span className={styles.personName}>{t.acct_recurring_line.replace("{amount}", usd(g.amountCents)).replace("{fund}", paymentLabel({ kind: "DONATION", fund: g.fund }, t))}</span>
                <span className={styles.muted}>{t.acct_recurring_since.replace("{date}", date(g.createdAt))}</span>
                <form action={cancelMonthlyGift}>
                  <input type="hidden" name="subscriptionId" value={g.id} />
                  <ConfirmButton message={t.acct_cancel_gift_confirm} className={styles.linkDanger}>
                    {t.acct_cancel_gift}
                  </ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card} aria-labelledby="history-title">
        <div className={styles.cardHead}>
          <h2 id="history-title" className={styles.cardTitle}>
            {t.acct_history_title}
          </h2>
          {years.length > 0 && (
            <span className={styles.statements}>
              {years.map((y) => (
                <Link key={y} href={`/account/giving/statement?year=${y}`}>
                  {t.acct_statement.replace("{year}", y)}
                </Link>
              ))}
            </span>
          )}
        </div>
        {payments.length === 0 ? (
          <p className={styles.text}>{t.acct_no_payments}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t.acct_th_date}</th>
                  <th>{t.acct_th_for}</th>
                  <th>{t.acct_th_amount}</th>
                  <th>{t.receipt_number}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.paidAt ? date(p.paidAt) : "—"}</td>
                    <td>
                      {paymentLabel(p, t)}
                      {p.frequency !== "ONE_TIME" && <span className={styles.muted}> · {p.frequency === "MONTHLY" ? t.m3_monthly : t.m3_yearly}</span>}
                    </td>
                    <td>
                      {usd(p.amountCents)}
                      {p.status === "REFUNDED" && <span className={styles.muted}> · {t.acct_refunded}</span>}
                    </td>
                    <td>
                      {p.receiptNumber ? (
                        <Link href={`/account/giving/${p.id}`}>
                          <bdi>{p.receiptNumber}</bdi>
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

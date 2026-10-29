import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/dictionary";
import { FUNDS, usd } from "@/lib/payments/catalog";
import { routes } from "@/lib/routes";
import styles from "../donate.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.donate_thanks_heading, robots: { index: false } };
}

// "j***@example.com" — the page address is shareable, so don't print the full email.
const maskEmail = (e: string) => e.replace(/^(.)[^@]*/, "$1***");

export default async function ThankYouPage({ searchParams }: PageProps<"/donate/thank-you">) {
  const [{ t }, { checkout, pending }] = await Promise.all([getI18n(), searchParams]);
  const session = typeof checkout === "string" ? await db.checkoutSession.findUnique({ where: { id: checkout } }) : null;
  // Back from Stripe/PayPal, approved but not confirmed yet: the webhook finishes it.
  if (session && session.kind === "DONATION" && session.status === "OPEN" && pending) {
    return (
      <section className="container section-y">
        <div className={styles.result}>
          <div className={styles.check} aria-hidden>
            …
          </div>
          <h1 className={styles.resultH}>{t.pay_processing_heading}</h1>
          <p className={styles.resultP}>{t.pay_processing_text}</p>
        </div>
      </section>
    );
  }
  if (!session || session.kind !== "DONATION" || session.status !== "COMPLETED") redirect(routes.donate);
  const payment = await db.payment.findFirst({ where: { providerCheckoutId: session.id } });
  const fundKey = FUNDS.find((f) => f.id === session.fund)?.nameKey;
  const fund = fundKey ? t[fundKey as MessageKey] : "";
  const line = (session.frequency === "MONTHLY" ? t.donate_thanks_monthly : t.donate_thanks_once).replace("{amount}", usd(session.amountCents)).replace("{fund}", fund);

  return (
    <section className="container section-y">
      <div className={styles.result}>
        <div className={styles.check} aria-hidden>
          ✓
        </div>
        <h1 className={styles.resultH}>{t.donate_thanks_heading}</h1>
        <p className={styles.resultP}>{line}</p>
        {/* Say it was emailed only if it really was; otherwise point to My account → Giving. */}
        {payment?.receiptSentAt ? (
          <p className={styles.resultP}>{t.donate_receipt_sent.replace("{email}", maskEmail(payment.donorEmail))}</p>
        ) : (
          <p className={styles.resultP}>{t.receipt_in_account}</p>
        )}
        {payment?.receiptNumber && (
          <p className={styles.resultMeta}>
            {t.receipt_number}: <strong>{payment.receiptNumber}</strong>
          </p>
        )}
        <div className={styles.resultActions}>
          <Link href={routes.home} className="btn btn-dark">
            {t.back_home}
          </Link>
          <Link href={routes.donate} className="btn btn-primary">
            {t.donate_again}
          </Link>
        </div>
      </div>
    </section>
  );
}

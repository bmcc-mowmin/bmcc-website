import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { env } from "@/lib/env";
import { routes } from "@/lib/routes";
import { DEFAULT_FUND, isFund } from "@/lib/payments/catalog";
import { DonateForm } from "./DonateForm";
import styles from "./donate.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav_donate, description: t.donate_paragraph };
}

export default async function DonatePage({ searchParams }: PageProps<"/donate">) {
  const [{ t }, params] = await Promise.all([getI18n(), searchParams]);
  const fund = isFund(params.fund) ? params.fund : DEFAULT_FUND;
  const benefits = [t.benefit1, t.benefit2, t.benefit3, t.benefit4, t.benefit5, t.benefit6];
  return (
    <section className="container section-y">
      <div className="page-intro">
        <div className="eyebrow">{t.donate_eyebrow}</div>
        <h1 className={`page-h1 ${styles.h1}`}>{t.donate_heading}</h1>
        <p className="lead">{t.donate_paragraph}</p>
      </div>
      {params.canceled && (
        <p role="status" className={styles.canceled}>
          {t.donate_canceled}
        </p>
      )}
      <div className={styles.grid}>
        <DonateForm defaultFrequency={env.DEFAULT_DONATION_FREQUENCY} initialFund={fund} />
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{t.donate_join_title}</h2>
          <p className={styles.cardSub}>
            {t.donate_join_sub_prefix} <Link href={routes.funeral}>{t.donate_join_sub_link}</Link>.
          </p>
          <ul className={styles.benefits}>
            {benefits.map((b) => (
              <li key={b}>
                <span aria-hidden>✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <Link href={routes.membership} className={styles.joinButton}>
            {t.btn_become_member}
          </Link>
        </div>
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { intlLocale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
import { resumeDuesPayment } from "../actions";
import styles from "../membership.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav_membership, robots: { index: false } };
}

const maskEmail = (e: string) => e.replace(/^(.)[^@]*/, "$1***");

// Where checkout returns to — paid (welcome + benefit start date) or not (offer to finish paying).
export default async function MembershipComplete({ searchParams }: PageProps<"/membership/complete">) {
  const [{ t, lang }, { checkout }] = await Promise.all([getI18n(), searchParams]);
  const session =
    typeof checkout === "string"
      ? await db.checkoutSession.findUnique({ where: { id: checkout }, include: { membership: { include: { household: true } } } })
      : null;
  const m = session?.membership;
  if (!session || session.kind !== "DUES" || !m) redirect(routes.membership);

  if (m.status === "PENDING_PAYMENT") {
    return (
      <section className={styles.result}>
        <div className={`${styles.check} ${styles.warn}`} aria-hidden>
          !
        </div>
        <h1 className={styles.resultH}>{t.m_unpaid_heading}</h1>
        <p className={styles.resultP}>{t.m_unpaid_text}</p>
        <p className={styles.resultMeta}>
          {t.reference_id} <strong>{m.referenceId}</strong>
        </p>
        <form action={resumeDuesPayment}>
          <input type="hidden" name="checkoutId" value={session.id} />
          <button type="submit" className="btn btn-primary">
            {t.m_complete_payment} →
          </button>
        </form>
      </section>
    );
  }

  const starts = m.benefitEligibleFrom
    ? new Intl.DateTimeFormat(intlLocale(lang), { dateStyle: "long", timeZone: "America/Los_Angeles" }).format(m.benefitEligibleFrom)
    : "";
  return (
    <section className={styles.result}>
      <div className={styles.check} aria-hidden>
        ✓
      </div>
      <h1 className={styles.resultH}>{t.m_paid_heading}</h1>
      <p className={styles.resultP}>{t.m_paid_paragraph.replace("{email}", maskEmail(m.household.email))}</p>
      {starts && <p className={styles.resultP}>{t.m_benefit_starts.replace("{date}", starts)}</p>}
      <p className={styles.resultMeta}>
        {t.reference_id} <strong>{m.referenceId}</strong>
      </p>
      <p className={styles.resultP} style={{ fontSize: 14, color: "var(--muted)" }}>
        {t.confirm_note}
      </p>
      <Link href={routes.home} className="btn btn-dark" style={{ marginTop: 16 }}>
        {t.back_home}
      </Link>
    </section>
  );
}

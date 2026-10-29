import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { requireMember } from "@/lib/auth";
import { getMyMemberships } from "@/lib/account";
import { coverage, type Coverage } from "@/lib/membership/coverage";
import { masjidClock } from "@/lib/prayer/schedule";
import { routes } from "@/lib/routes";
import type { MessageKey } from "@/lib/i18n/dictionary";
import { payPendingDues } from "./actions";
import { PayButtons } from "@/components/payments/PayButtons";
import { methodsFor } from "@/lib/payments/provider";
import { formatDate } from "./format";
import styles from "./account.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.acct_title, robots: { index: false } };
}

const TONE: Record<Coverage, string> = { covered: "good", waiting: "info", grace: "warn", paused: "bad", canceled: "muted", not_enrolled: "warn" };

export default async function AccountOverview() {
  const user = await requireMember("/account");
  const { t, lang } = await getI18n();
  const [memberships, { timeZone }] = await Promise.all([getMyMemberships(user), masjidClock()]);
  const date = (d: Date) => formatDate(d, lang, timeZone);
  const duesMethods = methodsFor("dues");

  if (memberships.length === 0) {
    return (
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>{t.acct_no_membership_title}</h2>
        <p className={styles.text}>{t.acct_no_membership_text}</p>
        <Link href={routes.membership} className="btn btn-primary">
          {t.nav_membership}
        </Link>
      </div>
    );
  }

  return (
    <>
      {memberships.map((m) => {
        const cov = coverage(m);
        const nextDue = m.subscriptions[0]?.currentPeriodEnd;
        return (
          <section key={m.id} className={styles.card} aria-labelledby={`m-${m.id}`}>
            <div className={styles.cardHead}>
              <h2 id={`m-${m.id}`} className={styles.cardTitle}>
                {t.acct_membership_title}
              </h2>
              <span className={`${styles.badge} ${styles[TONE[cov]]}`}>{t[`cov_${cov}` as MessageKey]}</span>
            </div>

            {cov === "not_enrolled" && m.status === "PENDING_PAYMENT" && (
              <div className={styles.notice}>
                <p>{t.acct_pending_note}</p>
                <form action={payPendingDues}>
                  <input type="hidden" name="membershipId" value={m.id} />
                  <PayButtons methods={duesMethods} className="btn btn-primary" label={(x) => (duesMethods.length < 2 ? t.acct_pay_now : x === "paypal" ? t.pay_with_paypal : t.pay_by_card)} />
                </form>
              </div>
            )}
            {cov === "grace" && m.graceEndsAt && <p className={styles.notice}>{t.acct_grace_note.replace("{date}", date(m.graceEndsAt))}</p>}
            {cov === "paused" && <p className={styles.notice}>{t.acct_paused_note}</p>}

            <dl className={styles.facts}>
              <dt>{t.acct_plan}</dt>
              <dd>{m.plan === "YEARLY" ? t.acct_plan_yearly : t.acct_plan_monthly}</dd>
              <dt>{t.acct_reference}</dt>
              <dd>
                <bdi>{m.referenceId}</bdi>
              </dd>
              <dt>{t.acct_member_id}</dt>
              <dd>{m.membershipNumber ? <bdi>{m.membershipNumber}</bdi> : <span className={styles.muted}>{t.acct_member_id_pending}</span>}</dd>
              {m.enrolledAt && (
                <>
                  <dt>{t.acct_member_since}</dt>
                  <dd>{date(m.enrolledAt)}</dd>
                </>
              )}
              {m.benefitEligibleFrom && (
                <>
                  <dt>{t.acct_benefit_starts}</dt>
                  <dd>{date(m.benefitEligibleFrom)}</dd>
                </>
              )}
              {nextDue && m.status !== "CANCELLED" && (
                <>
                  <dt>{t.acct_next_payment}</dt>
                  <dd>{date(nextDue)}</dd>
                </>
              )}
              <dt>{t.acct_covered_people}</dt>
              <dd>
                {m.household.members.length} · <Link href="/account/household">{t.acct_view_household}</Link>
              </dd>
            </dl>
            <p className={styles.small}>
              {t.acct_cancel_membership_note} <Link href={routes.funeral}>{t.acct_policy_link}</Link>
            </p>
          </section>
        );
      })}
    </>
  );
}

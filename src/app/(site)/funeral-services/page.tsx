import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import styles from "./funeral.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav_funeral };
}

export default async function FuneralServicesPage() {
  const { t } = await getI18n();
  const policySections = [
    { n: "1", title: t.ps_1_title, points: [t.ps_1_p1, t.ps_1_p2, t.ps_1_p3] },
    { n: "2", title: t.ps_2_title, points: [t.ps_2_p1] },
    { n: "3", title: t.ps_3_title, points: [t.ps_3_p1, t.ps_3_p2, t.ps_3_p3] },
    { n: "4", title: t.ps_4_title, points: [t.ps_4_p1, t.ps_4_p2] },
    { n: "5", title: t.ps_5_title, points: [t.ps_5_p1] },
    { n: "6", title: t.ps_6_title, points: [t.ps_6_p1, t.ps_6_p2, t.ps_6_p3] },
  ];
  const stats = [
    [t.stat_amount, t.stat_amount_label],
    [t.stat_wait, t.stat_wait_label],
    [t.stat_paid, t.stat_paid_label],
  ];

  return (
    <>
      <section className={styles.hero}>
        <div className="container-policy section-y">
          <div className={styles.heroEyebrow}>{t.funeral_eyebrow}</div>
          <h1 className={styles.heroH1}>{t.funeral_heading}</h1>
          <p className={styles.heroP}>{t.funeral_hero_paragraph}</p>
        </div>
      </section>

      <div className={styles.notice}>
        <div className={`container-policy ${styles.noticeInner}`}>{t.funeral_notice}</div>
      </div>

      <section className={`container-policy ${styles.disclaimerSection}`}>
        <div className={styles.disclaimer}>
          <h2>{t.disclaimer_heading}</h2>
          <p>{t.disclaimer_p1}</p>
          <p>{t.disclaimer_p2}</p>
          <p>{t.disclaimer_p3}</p>
          <p>{t.disclaimer_p4}</p>
        </div>
      </section>

      <section className={`container-policy ${styles.statsSection}`}>
        <div className="g3">
          {stats.map(([value, label]) => (
            <div key={label} className={styles.stat}>
              <div className={styles.statValue}>{value}</div>
              <div className={styles.statLabel}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-policy section-y">
        {policySections.map((sec) => (
          <div key={sec.n} className={styles.policy}>
            <div className={styles.policyNumber}>{sec.n}</div>
            <div>
              <h2 className={styles.policyTitle}>{sec.title}</h2>
              {sec.points.map((p) => (
                <p key={p} className={styles.policyPoint}>
                  {p}
                </p>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className={styles.hero}>
        <div className={`container-policy section-y ${styles.center}`}>
          <h2 className={styles.ctaH2}>{t.not_member_heading}</h2>
          <p className={styles.ctaP}>{t.not_member_paragraph}</p>
          <Link href={routes.membership} className={`btn btn-primary ${styles.ctaButton}`}>
            {t.btn_become_member}
          </Link>
        </div>
      </section>

      <section className={styles.checklistBand}>
        <div className="container-policy section-y">
          <h2 className={styles.checklistH2}>{t.checklist_heading}</h2>
          <p className={styles.checklistP}>{t.checklist_paragraph}</p>
          <ul className={styles.checklist}>
            <li>
              <span aria-hidden>✓</span>
              <span>{t.checklist_1}</span>
            </li>
            <li>
              <span aria-hidden>✓</span>
              <span>{t.checklist_2}</span>
            </li>
          </ul>
        </div>
      </section>

      <section className={`container-policy section-y ${styles.center}`}>
        <h2 className={styles.questionsH2}>{t.funeral_questions_heading}</h2>
        <p className={styles.questionsP}>{t.funeral_questions_paragraph}</p>
        <Link href={routes.contact} className="btn btn-primary">
          {t.contact_bmcc}
        </Link>
      </section>
    </>
  );
}

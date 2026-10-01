import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { MembershipForm } from "./MembershipForm";
import styles from "./membership.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
  title: t.nav_membership,
  description: t.membership_hero_paragraph,
};
}

export default async function MembershipPage() {
  const { t } = await getI18n();
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroEyebrow}>{t.membership_eyebrow}</div>
          <h1 className={styles.heroH1}>{t.membership_heading}</h1>
          <p className={styles.heroP}>{t.membership_hero_paragraph}</p>
        </div>
      </section>
      <div className={styles.wrap}>
        <MembershipForm />
      </div>
    </>
  );
}

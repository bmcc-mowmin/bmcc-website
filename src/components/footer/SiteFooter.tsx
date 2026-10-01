import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { org } from "@/lib/org";
import { routes } from "@/lib/routes";
import styles from "./Footer.module.css";

export async function SiteFooter() {
  const { t } = await getI18n();
  return (
    <footer className={styles.footer}>
      <div className={styles.grid}>
        <div>
          <div className={styles.logoWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size logo */}
            <img src="/brand/bmcc-logo.jpeg" alt="Brentwood Muslim Community Center" className={styles.logo} />
          </div>
          <p className={styles.tagline}>{t.footer_tagline}</p>
        </div>
        <nav aria-label={t.footer_programs}>
          <div className={styles.heading}>{t.footer_programs}</div>
          <div className={styles.links}>
            <a href={routes.hikmahSchool} target="_blank" rel="noopener">
              {t.nav_hikmah}
            </a>
            <Link href={routes.events}>{t.nav_events}</Link>
            <Link href={routes.community}>{t.nav_community}</Link>
            <Link href={routes.prayerTimes}>{t.nav_prayer}</Link>
          </div>
        </nav>
        <nav aria-label={t.footer_services}>
          <div className={styles.heading}>{t.footer_services}</div>
          <div className={styles.links}>
            <Link href={routes.services}>{t.footer_all_services}</Link>
            <Link href={routes.funeral}>{t.nav_funeral}</Link>
            <Link href={routes.assistance}>{t.footer_assistance}</Link>
          </div>
        </nav>
        <nav aria-label={t.footer_about}>
          <div className={styles.heading}>{t.footer_about}</div>
          <div className={styles.links}>
            <Link href={routes.about}>{t.footer_about_us}</Link>
            <Link href={routes.membership}>{t.footer_become_member}</Link>
            <Link href={routes.donate}>{t.footer_ways_to_give}</Link>
            <Link href={routes.contact}>{t.footer_contact_us}</Link>
          </div>
        </nav>
        <div>
          <div className={styles.heading}>{t.footer_contact}</div>
          <address className={styles.links}>
            <span>
              <bdi dir="ltr">{org.addressShort}</bdi>
            </span>
            <a href={org.phoneHref}>
              <bdi dir="ltr">{org.phone}</bdi>
            </a>
            <a href={`mailto:${org.email}`}>
              <bdi dir="ltr">{org.email}</bdi>
            </a>
          </address>
        </div>
      </div>
      <div className={styles.rights}>{t.footer_rights}</div>
    </footer>
  );
}

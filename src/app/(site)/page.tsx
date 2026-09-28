import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { getActiveAnnouncements } from "@/lib/content/announcements";
import { getTodayAndTomorrow, getUpcomingJumuah } from "@/lib/prayer/schedule";
import { contactHref, routes } from "@/lib/routes";
import { PrayerTable } from "@/components/prayer/PrayerTable";
import { formatDayLabel } from "@/lib/prayer/next-prayer";
import { intlLocale } from "@/lib/i18n/config";
import { MemberLoginCard } from "./MemberLoginCard";
import styles from "./home.module.css";

// Sections still to come: re-subscribe bar + newsletter (phase 6), events carousel (phase 3).
export default async function HomePage() {
  const { t, lang } = await getI18n();
  const [{ today }, jumuah, announcements] = await Promise.all([
    getTodayAndTomorrow(lang),
    getUpcomingJumuah(lang),
    getActiveAnnouncements(lang),
  ]);

  const tiles = [
    { title: t.tile_prayer_title, href: routes.prayerTimes, icon: "🕌", description: t.tile_prayer_desc },
    { title: t.tile_hikmah_title, href: routes.hikmahSchool, icon: "✎", description: t.tile_hikmah_desc, external: true },
    { title: t.tile_events_title, href: routes.events, icon: "◷", description: t.tile_events_desc },
    { title: t.tile_directory_title, href: routes.community, icon: "◈", description: t.tile_directory_desc },
    { title: t.tile_give_title, href: routes.donate, icon: "✦", description: t.tile_give_desc },
    { title: t.tile_services_title, href: routes.about, icon: "❖", description: t.tile_services_desc },
  ];
  const involved = [
    { title: t.involved_member_title, href: routes.membership, icon: "◈", description: t.involved_member_desc, cta: t.involved_member_cta },
    { title: t.involved_donate_title, href: routes.donate, icon: "✦", description: t.involved_donate_desc, cta: t.involved_donate_cta },
    { title: t.involved_listing_title, href: routes.community, icon: "◇", description: t.involved_listing_desc, cta: t.involved_listing_cta },
    { title: t.involved_idea_title, href: contactHref("idea"), icon: "✉", description: t.involved_idea_desc, cta: t.involved_idea_cta },
  ];
  const featured = announcements[0];

  return (
    <>
      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroHeading}>
          <div className={`eyebrow ${styles.heroEyebrow}`}>{t.home_eyebrow}</div>
          <h1 className={styles.heroH1}>{t.home_heading}</h1>
        </div>
        <div className={styles.heroTable}>
          <PrayerTable day={today} jumuah={jumuah} t={t} lang={lang} note={`${t.prayer_times_for} ${formatDayLabel(today.date, intlLocale(lang))} · ${t.asr_hanafi}`} />
        </div>
        <div className={styles.heroButtons}>
          <Link href={routes.donate} className={`${styles.heroBtn} ${styles.heroBtnPrimary}`}>
            {t.btn_donate}
          </Link>
          <Link href={routes.membership} className={`${styles.heroBtn} ${styles.heroBtnOutline}`}>
            {t.btn_become_member}
          </Link>
        </div>
        <div className={styles.heroPara}>
          <p>{t.home_paragraph}</p>
        </div>
      </section>

      {/* CATEGORY TILES */}
      <section className={styles.tilesBand}>
        <div className="container section-y">
          <div className="page-intro">
            <div className="eyebrow">{t.explore_eyebrow}</div>
            <h2 className={styles.h2}>{t.explore_heading}</h2>
          </div>
          <div className="g3">
            {tiles.map((c) => (
              <Link key={c.title} href={c.href} className={styles.tile} {...(c.external ? { target: "_blank", rel: "noopener" } : {})}>
                <span className={styles.tileIcon} aria-hidden>
                  {c.icon}
                </span>
                <span className={styles.tileTitle}>{c.title}</span>
                <span className={styles.tileDesc}>{c.description}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ANNOUNCEMENT STRIP — the top active announcement from admin */}
      {featured && (
        <div className={styles.strip}>
          <div className={`container ${styles.stripInner}`}>
            <span>
              {t.announcement_prefix}:{" "}
              {featured.href ? (
                <Link href={featured.href} dir="auto">
                  {featured.text}
                </Link>
              ) : (
                <span dir="auto">{featured.text}</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* MEMBER PORTAL */}
      <section id="member-access" className={styles.portal}>
        <div className={`container ${styles.portalGrid}`}>
          <div>
            <div className={styles.portalEyebrow}>{t.member_eyebrow}</div>
            <h2 className={styles.portalH2}>{t.member_heading}</h2>
            <p className={styles.portalP}>{t.member_paragraph}</p>
            <ul className={styles.portalPoints}>
              {[t.member_point1, t.member_point2, t.member_point3].map((p) => (
                <li key={p}>
                  <span aria-hidden>✓</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <MemberLoginCard />
        </div>
      </section>

      {/* GET INVOLVED */}
      <section className="container section-y">
        <div className="page-intro">
          <div className="eyebrow">{t.involved_eyebrow}</div>
          <h2 className={styles.h2}>{t.involved_heading}</h2>
        </div>
        <div className={styles.g4}>
          {involved.map((g) => (
            <div key={g.title} className={styles.involvedCard}>
              <span className={styles.tileIcon} aria-hidden>
                {g.icon}
              </span>
              <span className={styles.tileTitle}>{g.title}</span>
              <span className={`${styles.tileDesc} ${styles.grow}`}>{g.description}</span>
              <Link href={g.href} className={styles.involvedCta}>
                {g.cta} <span aria-hidden>→</span>
              </Link>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

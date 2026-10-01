import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { formatEventWhen, getUpcomingEvents } from "@/lib/events";
import { masjidClock } from "@/lib/prayer/schedule";
import styles from "./events.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
  title: t.nav_events,
  description: t.events_paragraph,
};
}

export default async function EventsPage() {
  const { t, lang } = await getI18n();
  const [events, { timeZone }] = await Promise.all([getUpcomingEvents(lang), masjidClock()]);
  return (
    <section className="container section-y">
      <div className={`page-intro ${styles.intro}`}>
        <div className="eyebrow">{t.events_eyebrow}</div>
        <h1 className="page-h1">{t.events_heading}</h1>
        <p className="lead">{t.events_paragraph}</p>
      </div>
      {events.length === 0 ? (
        <p className="lead">{t.events_empty}</p>
      ) : (
        <div className={styles.grid}>
          {events.map((e) => {
            const when = formatEventWhen(e, e.next, lang, t, timeZone);
            return (
              <article key={e.id} className={styles.card}>
                <div className={styles.top}>
                  <div className={styles.tag}>{e.tag}</div>
                  <div className={styles.when}>
                    {when.date}
                    {when.timeRange && (
                      <>
                        <br />
                        {when.timeRange}
                      </>
                    )}
                  </div>
                </div>
                <h2 className={styles.title}>
                  <Link href={`/events/${e.slug}`}>{e.title}</Link>
                </h2>
                <p className={styles.description}>{e.description}</p>
                <div className={styles.bottom}>
                  <span className={styles.location}>
                    <span aria-hidden>📍 </span>
                    {e.location}
                  </span>
                  <div className={styles.actions}>
                    <a href={e.icsUrl} className={styles.calButton} aria-label={`${t.events_ical}: ${e.title}`}>
                      {t.events_ical}
                    </a>
                    <a href={e.googleUrl} target="_blank" rel="noopener" className={styles.calButton} aria-label={`${t.events_gcal}: ${e.title}`}>
                      {t.events_gcal}
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

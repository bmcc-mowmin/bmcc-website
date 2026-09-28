import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { intlLocale } from "@/lib/i18n/config";
import { getTodayAndTomorrow, getUpcomingJumuah } from "@/lib/prayer/schedule";
import { formatClock, formatDayLabel } from "@/lib/prayer/next-prayer";
import { addDays } from "@/lib/time";
import { PrayerTable } from "@/components/prayer/PrayerTable";
import styles from "./prayer.module.css";

export const metadata: Metadata = {
  title: "Prayer Times",
  description: "Daily Adhan and Iqamah times for the Brentwood Muslim Community Center (Hanafi Asr), plus Jumu'ah services.",
};

export default async function PrayerTimesPage() {
  const { t, lang } = await getI18n();
  const locale = intlLocale(lang);
  const [{ today }, jumuah] = await Promise.all([getTodayAndTomorrow(lang), getUpcomingJumuah(lang)]);
  const month = today.date.slice(0, 7);
  const nextMonth = addDays(`${month}-28`, 7).slice(0, 7);
  const note = `${t.prayer_times_for} ${formatDayLabel(today.date, locale)} · ${t.asr_hanafi}`;

  return (
    <>
      <section className="container section-y">
        <div className="page-intro">
          <div className="eyebrow">{t.prayer_page_eyebrow}</div>
          <h1 className={`page-h1 ${styles.h1}`}>{t.prayer_page_heading}</h1>
          <p className="lead">{t.prayer_page_paragraph}</p>
        </div>
        <div className={styles.grid}>
          <PrayerTable day={today} jumuah={jumuah} t={t} lang={lang} note={note} jumuahRows="first" shadow={false} />
          <div className={styles.timetable}>
            <h2 className={styles.timetableH}>{t.timetable_heading}</h2>
            <p className={styles.timetableP}>{t.timetable_paragraph}</p>
            <div className={styles.timetableActions}>
              <a href={`/api/prayer-times/pdf?month=${month}`} className={styles.pdfButton} target="_blank" rel="noopener">
                {t.timetable_button}
              </a>
              <a href={`/api/prayer-times/pdf?month=${nextMonth}`} className={styles.nextMonth} target="_blank" rel="noopener">
                {t.timetable_next_month} ↓
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.jumuahBand}>
        <div className="container section-y">
          <div className="page-intro">
            <div className="eyebrow">{t.jumuah_eyebrow}</div>
            <h2 className={styles.jumuahH2}>{t.jumuah_heading}</h2>
          </div>
          <div className="g2">
            {jumuah.map((j) => (
              <div key={`${j.label}-${j.khutbah}`} className={styles.jumuahCard}>
                <div className={styles.jumuahLabel}>{j.label}</div>
                <div className={styles.jumuahLine}>@ {j.location}</div>
                <div className={styles.jumuahLine}>
                  {formatClock(j.khutbah, locale)} – {formatClock(j.iqamah, locale)}
                </div>
                {j.note && <div className={styles.jumuahNote}>{j.note}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

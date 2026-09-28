"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { intlLocale } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/dictionary";
import { formatClock, masjidNow, nextPrayer, type DaySchedule } from "@/lib/prayer/next-prayer";
import { routes } from "@/lib/routes";
import styles from "./Header.module.css";

export type PrayerFeed = { today: DaySchedule; tomorrow: DaySchedule; timeZone: string };

function compute({ today, tomorrow, timeZone }: PrayerFeed) {
  const now = masjidNow(timeZone);
  // If the page has been open past midnight at the masjid, tomorrow's schedule is "today".
  if (now.date === tomorrow.date) return nextPrayer(tomorrow, tomorrow, now.minutes);
  return nextPrayer(today, tomorrow, now.minutes);
}

export function NextPrayer({ feed }: { feed: PrayerFeed }) {
  const { t, lang } = useI18n();
  const [np, setNp] = useState(() => compute(feed));

  useEffect(() => {
    const timer = setInterval(() => setNp(compute(feed)), 30_000);
    return () => clearInterval(timer);
  }, [feed]);

  return (
    <div className={styles.nextPrayer}>
      <span className={styles.nextPrayerLabel}>{t.next_prayer}</span>
      <Link href={routes.prayerTimes} className={styles.nextPrayerLink} suppressHydrationWarning>
        {t[`prayer_${np.key}` as MessageKey]} {formatClock(np.time, intlLocale(lang))}
      </Link>
      {np.tomorrow && <span className={styles.tomorrow}>({t.tomorrow})</span>}
    </div>
  );
}

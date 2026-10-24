import { formatClock, type DaySchedule, type JumuahService } from "@/lib/prayer/next-prayer";
import { intlLocale, type Lang } from "@/lib/i18n/config";
import type { Dictionary, MessageKey } from "@/lib/i18n/dictionary";
import styles from "./PrayerTable.module.css";

// Adhan / Iqamah table used on Home and the Prayer Times page.
// Fed only by lib/prayer/schedule.ts — never hard-code times here.
export function PrayerTable({
  day,
  jumuah,
  t,
  lang,
  note,
  shadow = true,
}: {
  day: DaySchedule;
  jumuah: JumuahService[];
  t: Dictionary;
  lang: Lang;
  note?: string;
  shadow?: boolean;
}) {
  const locale = intlLocale(lang);
  // One row per Jumu'ah service, on Home and the Prayer Times page alike.
  const jumuahList = jumuah.map((j) => ({ name: j.label, adhan: j.khutbah, iqamah: j.iqamah }));
  const rows = [
    ...day.prayers.map((p) => ({ name: t[`prayer_${p.key}` as MessageKey], adhan: p.adhan, iqamah: p.iqamah })),
    ...jumuahList,
  ];
  // CSS grid rows (like the design) with ARIA table roles: one background per row, so
  // no hairline seams between cells, and screen readers still announce a table.
  return (
    <div className={`${styles.card} ${shadow ? styles.shadow : ""}`}>
      <div role="table" aria-label={t.prayer_th_prayer}>
        <div role="rowgroup">
          <div role="row" className={`${styles.grid} ${styles.head}`}>
            <div role="columnheader">{t.prayer_th_prayer}</div>
            <div role="columnheader">{t.prayer_th_adhan}</div>
            <div role="columnheader">{t.prayer_th_iqamah}</div>
          </div>
        </div>
        <div role="rowgroup">
          {rows.map((r) => (
            <div role="row" key={`${r.name}-${r.adhan}`} className={`${styles.grid} ${styles.row}`}>
              <div role="rowheader" className={styles.name}>
                {r.name}
              </div>
              <div role="cell">{formatClock(r.adhan, locale)}</div>
              <div role="cell">{formatClock(r.iqamah, locale)}</div>
            </div>
          ))}
        </div>
      </div>
      {note && <div className={styles.note}>{note}</div>}
    </div>
  );
}

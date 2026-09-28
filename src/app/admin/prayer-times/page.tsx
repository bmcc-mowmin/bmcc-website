import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCalculatedDay, getMonthSchedule, masjidClock } from "@/lib/prayer/schedule";
import { formatClock, formatDayLabel } from "@/lib/prayer/next-prayer";
import { DAILY_PRAYERS } from "@/lib/prayer/calculate";
import { addDays } from "@/lib/time";
import { ActionForm } from "@/components/admin/ActionForm";
import styles from "@/components/admin/admin.module.css";
import { PrayerTabs } from "./Tabs";
import { clearDayOverride, removeTimetable, saveDayOverride, uploadTimetable } from "./actions";

export const metadata: Metadata = { title: "Prayer times" };

const NAMES: Record<string, string> = { fajr: "Fajr", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };
const t12 = (hhmm: string) => formatClock(hhmm, "en-US");

export default async function PrayerTimesAdmin({ searchParams }: PageProps<"/admin/prayer-times">) {
  const params = await searchParams;
  const { date: today } = await masjidClock();
  const month = typeof params.month === "string" && /^\d{4}-\d{2}$/.test(params.month) ? params.month : today.slice(0, 7);
  const editDate = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : null;

  const [days, uploaded] = await Promise.all([getMonthSchedule(month), db.timetablePdf.findUnique({ where: { month } })]);
  const prevMonth = addDays(`${month}-01`, -1).slice(0, 7);
  const nextMonth = addDays(`${month}-28`, 7).slice(0, 7);
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));

  return (
    <>
      <h1 className={styles.pageTitle}>Prayer times</h1>
      <p className={styles.pageLead}>
        Adhan times are calculated for Brentwood with the <strong>Hanafi</strong> Asr method; Iqamah follows the rules on the
        next tab. Override any single day (Ramadan, Eid, a special event) and the header, Home page, Prayer Times page, API
        and PDF all change together.
      </p>
      <PrayerTabs active="month" />

      {editDate && <DayEditor date={editDate} month={month} status={typeof params.status === "string" ? params.status : undefined} />}

      <section className={styles.card} aria-labelledby="month-title">
        <div className={styles.monthNav}>
          <Link href={`?month=${prevMonth}`} aria-label="Previous month">
            ←
          </Link>
          <h2 id="month-title" className={styles.cardTitle} style={{ margin: 0 }}>
            {monthLabel}
          </h2>
          <Link href={`?month=${nextMonth}`} aria-label="Next month">
            →
          </Link>
          <Link href={`/api/prayer-times/pdf?month=${month}`} target="_blank" style={{ marginInlineStart: "auto", fontSize: 14 }}>
            View PDF ↗
          </Link>
        </div>
        <p className={styles.cardLead}>
          Adhan / <strong>Iqamah</strong>. <span className={styles.overridden}>Orange</span> = set by an admin for that day.
          Click a date to override it.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                {DAILY_PRAYERS.map((p) => (
                  <th key={p}>{NAMES[p]}</th>
                ))}
                <th>Jumu&apos;ah</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date} className={`${d.weekday === 5 ? styles.friday : ""} ${d.date === today ? styles.today : ""}`}>
                  <td>
                    <Link href={`?month=${month}&date=${d.date}#editor`}>
                      {new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${d.date}T12:00:00Z`))}
                    </Link>
                  </td>
                  {d.prayers.map((p) => (
                    <td key={p.key}>
                      <span className={d.overridden.includes(`${p.key}Adhan`) ? styles.overridden : undefined}>{t12(p.adhan)}</span>
                      {" / "}
                      <strong className={d.overridden.includes(`${p.key}Iqamah`) ? styles.overridden : undefined}>{t12(p.iqamah)}</strong>
                    </td>
                  ))}
                  <td className={d.overridden.includes("jumuah") ? styles.overridden : undefined}>
                    {d.jumuah.map((j) => `${t12(j.khutbah)}/${t12(j.iqamah)}`).join(", ")}
                  </td>
                  <td>{d.overridden.length || d.note ? <span className={`${styles.badge} ${styles.badgeWarn}`}>{d.note ?? "Adjusted"}</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="pdf-title">
        <h2 id="pdf-title" className={styles.cardTitle}>
          Printable PDF for {monthLabel}
        </h2>
        <p className={styles.cardLead}>
          {uploaded ? (
            <>
              Visitors get the <strong>uploaded file</strong> (uploaded{" "}
              {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(uploaded.createdAt)}). Remove it to go back to
              the generated timetable.
            </>
          ) : (
            <>Visitors get a timetable generated from the times above. Upload a PDF only if the masjid has its own printed version.</>
          )}
        </p>
        <div className={styles.row} style={{ gap: 24 }}>
          <ActionForm action={uploadTimetable} submitLabel={uploaded ? "Replace PDF" : "Upload PDF"} resetOnSuccess>
            <input type="hidden" name="month" value={month} />
            <input type="file" name="file" accept="application/pdf" required aria-label="PDF file" />
          </ActionForm>
          {uploaded && (
            <ActionForm action={removeTimetable} submitLabel="Remove uploaded PDF" variant="danger" confirm="Remove the uploaded PDF?">
              <input type="hidden" name="month" value={month} />
            </ActionForm>
          )}
        </div>
      </section>
    </>
  );
}

async function DayEditor({ date, month, status }: { date: string; month: string; status?: string }) {
  const [calculated, override] = await Promise.all([
    getCalculatedDay(date),
    db.prayerDayOverride.findUnique({ where: { date: new Date(`${date}T00:00:00Z`) } }),
  ]);
  const o = (override ?? {}) as Record<string, unknown>;
  const jumuahOverride = Array.isArray(override?.jumuah) ? (override.jumuah as Record<string, string>[]) : [];
  const isFriday = calculated.weekday === 5;

  return (
    <section id="editor" className={styles.card} aria-labelledby="editor-title" style={{ borderColor: "var(--primary)" }}>
      <div className={styles.monthNav}>
        <h2 id="editor-title" className={styles.cardTitle} style={{ margin: 0 }}>
          Override {formatDayLabel(date, "en-US")}
        </h2>
        <Link href={`?month=${month}`} style={{ marginInlineStart: "auto", fontSize: 14 }}>
          Close
        </Link>
      </div>
      {status === "saved" && (
        <p role="status" className={styles.ok}>
          Saved. The site now uses these times for this day.
        </p>
      )}
      {status === "cleared" && (
        <p role="status" className={styles.ok}>
          Cleared. This day uses the calculated times again.
        </p>
      )}
      <p className={styles.cardLead}>
        Leave a box empty to keep the calculated time. If you change only the Adhan, the Iqamah rule is applied to your new
        Adhan time.
      </p>
      <ActionForm key={override?.updatedAt.toISOString() ?? "none"} action={saveDayOverride} submitLabel="Save override">
        <input type="hidden" name="date" value={date} />
        <div className={styles.prayerGrid}>
          <span />
          <span className={styles.label}>Adhan</span>
          <span className={styles.label}>Iqamah</span>
          <span className={styles.label}>Calculated</span>
          {calculated.prayers.map((p) => (
            <PrayerRow key={p.key} name={NAMES[p.key]} prayer={p.key} adhan={o[`${p.key}Adhan`]} iqamah={o[`${p.key}Iqamah`]} calc={`${t12(p.adhan)} / ${t12(p.iqamah)}`} />
          ))}
        </div>

        {isFriday && (
          <fieldset style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <legend className={styles.label}>Jumu&apos;ah for this Friday (optional — replaces the regular services)</legend>
            <p className={styles.hint} style={{ marginTop: 0 }}>
              Regular: {calculated.jumuah.map((j) => `${j.label} ${t12(j.khutbah)}/${t12(j.iqamah)}`).join(" · ")}
            </p>
            {[0, 1, 2].map((i) => (
              <div key={i} className={styles.row} style={{ marginBottom: 8 }}>
                <input name={`jumuah.${i}.label`} placeholder="Label, e.g. First Jumu'ah" defaultValue={jumuahOverride[i]?.label ?? ""} className={styles.input} aria-label={`Jumu'ah ${i + 1} label`} />
                <input type="time" name={`jumuah.${i}.khutbah`} defaultValue={jumuahOverride[i]?.khutbah ?? ""} className={styles.input} aria-label={`Jumu'ah ${i + 1} khutbah`} />
                <input type="time" name={`jumuah.${i}.iqamah`} defaultValue={jumuahOverride[i]?.iqamah ?? ""} className={styles.input} aria-label={`Jumu'ah ${i + 1} iqamah`} />
                <input name={`jumuah.${i}.location`} placeholder="Location" defaultValue={jumuahOverride[i]?.location ?? ""} className={styles.input} aria-label={`Jumu'ah ${i + 1} location`} />
              </div>
            ))}
          </fieldset>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="override-note">
            Note (admin only, e.g. &quot;Eid al-Adha&quot;)
          </label>
          <input id="override-note" name="note" defaultValue={override?.note ?? ""} className={styles.input} maxLength={120} />
        </div>
      </ActionForm>
      {override && (
        <div style={{ marginTop: 10 }}>
          <ActionForm action={clearDayOverride} submitLabel="Clear override (use calculated times)" variant="danger" confirm="Clear all overrides for this day?">
            <input type="hidden" name="date" value={date} />
          </ActionForm>
        </div>
      )}
    </section>
  );
}

function PrayerRow({ name, prayer, adhan, iqamah, calc }: { name: string; prayer: string; adhan: unknown; iqamah: unknown; calc: string }) {
  return (
    <>
      <span style={{ fontWeight: 700 }}>{name}</span>
      <input type="time" name={`${prayer}Adhan`} defaultValue={typeof adhan === "string" ? adhan : ""} className={styles.input} aria-label={`${name} Adhan`} />
      <input type="time" name={`${prayer}Iqamah`} defaultValue={typeof iqamah === "string" ? iqamah : ""} className={styles.input} aria-label={`${name} Iqamah`} />
      <span className={styles.muted}>{calc}</span>
    </>
  );
}
